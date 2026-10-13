use crate::{config::StoreWrapper, APP};
use once_cell::sync::Lazy;
use reqwest::{redirect::Policy, Client, NoProxy, Proxy, Url};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashMap, sync::Mutex, time::Duration};
use tauri::Manager;

// Built-in providers use explicit app settings, never process or system proxies.
#[derive(Clone, PartialEq, Eq, Default)]
struct ProxySettings {
    address: Option<String>,
    exclusions: String,
    username: String,
    password: String,
}

impl ProxySettings {
    fn from_config(get: impl Fn(&str) -> Option<Value>) -> Result<Self, String> {
        if !get("proxy_enable")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Ok(Self::default());
        }
        let string = |key| {
            get(key)
                .and_then(|v| v.as_str().map(str::to_owned))
                .unwrap_or_default()
        };
        let host = string("proxy_host");
        let host = host.trim();
        let port = get("proxy_port")
            .and_then(|v| {
                v.as_u64()
                    .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
            })
            .filter(|p| (1..=65535).contains(p))
            .ok_or("代理端口必须为 1–65535")?;
        let mut url = Url::parse(&if host.contains("://") {
            host.to_owned()
        } else {
            format!("http://{host}")
        })
        .map_err(|_| "代理主机地址无效")?;
        if !matches!(url.scheme(), "http" | "https")
            || url.host_str().is_none()
            || !url.username().is_empty()
            || url.password().is_some()
            || url.path() != "/"
            || url.query().is_some()
            || url.fragment().is_some()
        {
            return Err("请填写 HTTP 代理主机，凭据请使用单独的用户名和密码字段".into());
        }
        url.set_port(Some(port as u16))
            .map_err(|_| "代理端口无效")?;
        Ok(Self {
            address: Some(url.to_string()),
            exclusions: string("no_proxy"),
            username: string("proxy_username"),
            password: string("proxy_password"),
        })
    }

    fn mode(&self) -> &'static str {
        if self.address.is_some() {
            "custom"
        } else {
            "direct"
        }
    }

    fn client(&self) -> Result<Client, String> {
        let mut builder = Client::builder()
            .no_proxy()
            .redirect(Policy::none())
            .connect_timeout(Duration::from_secs(8))
            .timeout(Duration::from_secs(20));
        if let Some(address) = &self.address {
            let mut proxy = Proxy::all(address)
                .map_err(|_| "代理地址无效")?
                .no_proxy(NoProxy::from_string(&self.exclusions));
            if !self.username.is_empty() {
                proxy = proxy.basic_auth(&self.username, &self.password);
            }
            builder = builder.proxy(proxy);
        }
        builder
            .build()
            .map_err(|_| "无法初始化服务网络客户端".into())
    }
}

#[derive(Default)]
struct ClientCache {
    current: Option<(ProxySettings, Client)>,
    generation: u64,
}

impl ClientCache {
    fn get(&mut self, settings: &ProxySettings) -> Result<Client, String> {
        if self.current.as_ref().map(|(s, _)| s) != Some(settings) {
            self.current = Some((settings.clone(), settings.client()?));
            self.generation += 1;
        }
        Ok(self.current.as_ref().unwrap().1.clone())
    }
}

static CLIENT: Lazy<Mutex<ClientCache>> = Lazy::new(|| Mutex::new(ClientCache::default()));

fn settings() -> Result<ProxySettings, String> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let store = state.0.lock().map_err(|_| "无法读取代理配置")?;
    ProxySettings::from_config(|key| store.get(key).cloned())
}

// Keep the legacy backup/plugin path using the same validated host and port.
pub fn legacy_proxy_values() -> Result<(String, String), String> {
    let settings = settings()?;
    Ok((
        settings.address.ok_or("应用代理未启用")?,
        settings.exclusions,
    ))
}

#[derive(Serialize)]
pub struct TransportStatus {
    mode: &'static str,
    generation: u64,
}

#[tauri::command]
pub fn service_http_status() -> Result<TransportStatus, String> {
    let settings = settings()?;
    let mut cache = CLIENT.lock().map_err(|_| "无法更新网络客户端")?;
    cache.get(&settings)?;
    Ok(TransportStatus {
        mode: settings.mode(),
        generation: cache.generation,
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceRequest {
    url: String,
    method: String,
    #[serde(default)]
    query: Vec<(String, String)>,
    form: Option<HashMap<String, String>>,
    response_type: u8,
    timeout: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceResponse {
    status: u16,
    ok: bool,
    data: Value,
    content_type: String,
    redirect_host: Option<String>,
    proxy_mode: &'static str,
}

fn network_error(error: reqwest::Error) -> String {
    // reqwest errors may contain translation text, signed forms or proxy credentials.
    if error.is_timeout() {
        "网络请求超时，请检查应用代理和网络连接"
    } else if error.is_connect() {
        "无法连接服务，请检查应用代理和网络连接"
    } else {
        "服务网络请求失败，请检查网络连接"
    }
    .into()
}

#[tauri::command]
pub async fn service_http_request(
    window: tauri::Window,
    request: ServiceRequest,
) -> Result<ServiceResponse, String> {
    let url = Url::parse(&request.url).map_err(|_| "服务地址无效")?;
    if !matches!(url.scheme(), "http" | "https")
        || !url.username().is_empty()
        || url.password().is_some()
        || !window
            .config()
            .tauri
            .allowlist
            .http
            .scope
            .0
            .iter()
            .any(|allowed| {
                glob::Pattern::new(allowed.as_str())
                    .map_or(false, |pattern| pattern.matches(url.as_str()))
            })
    {
        return Err("服务地址不在允许的 HTTP/HTTPS 范围内".into());
    }
    let method = match request.method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("服务请求只支持 GET 或 POST".into()),
    };
    let settings = settings()?;
    let client = CLIENT
        .lock()
        .map_err(|_| "无法读取网络客户端")?
        .get(&settings)?;
    let mut builder = client
        .request(method, url.clone())
        .query(&request.query)
        .timeout(Duration::from_secs(request.timeout.clamp(1, 30)));
    if let Some(form) = request.form {
        builder = builder.form(&form);
    }
    let response = builder.send().await.map_err(network_error)?;
    let status = response.status();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_owned();
    let redirect_host = response
        .headers()
        .get("location")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| url.join(v).ok())
        .and_then(|v| v.host_str().map(str::to_owned));
    log::info!(
        "SERVICE_HTTP host={} status={} proxy={}",
        url.host_str().unwrap_or(""),
        status.as_u16(),
        settings.mode()
    );
    let bytes = response.bytes().await.map_err(network_error)?;
    let data = match request.response_type {
        3 => serde_json::json!(bytes.to_vec()),
        2 => Value::String(String::from_utf8_lossy(&bytes).into_owned()),
        _ => serde_json::from_slice(&bytes)
            .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into_owned())),
    };
    Ok(ServiceResponse {
        status: status.as_u16(),
        ok: status.is_success(),
        data,
        content_type,
        redirect_host,
        proxy_mode: settings.mode(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        thread,
    };

    // A local transport probe, never a substitute for a live Google result.
    fn probe() -> (String, thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let handle = thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut request = [0; 4096];
            let count = stream.read(&mut request).unwrap();
            stream
                .write_all(b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK")
                .unwrap();
            String::from_utf8_lossy(&request[..count]).into_owned()
        });
        (address, handle)
    }

    #[test]
    fn proxy_config_validates_without_credentials_in_errors() {
        let mut config = serde_json::json!({"proxy_enable": true, "proxy_host": "127.0.0.1", "proxy_port": "7897"});
        assert_eq!(
            ProxySettings::from_config(|k| config.get(k).cloned())
                .unwrap()
                .address
                .as_deref(),
            Some("http://127.0.0.1:7897/")
        );
        config["proxy_host"] = serde_json::json!("http://secret:password@localhost");
        let message = ProxySettings::from_config(|k| config.get(k).cloned())
            .err()
            .unwrap();
        assert!(!message.contains("secret") && !message.contains("password"));
        config["proxy_enable"] = serde_json::json!(false);
        assert_eq!(
            ProxySettings::from_config(|k| config.get(k).cloned())
                .unwrap()
                .mode(),
            "direct"
        );
    }

    #[test]
    fn cache_switches_routes_and_honors_exclusions_without_restart() {
        tauri::async_runtime::block_on(async {
            let mut cache = ClientCache::default();
            let direct = ProxySettings::default();
            let (proxy, hit) = probe();
            let custom = ProxySettings {
                address: Some(proxy),
                ..Default::default()
            };
            let response = cache
                .get(&custom)
                .unwrap()
                .get("http://sui-transport.invalid/route")
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 200);
            assert!(hit
                .join()
                .unwrap()
                .starts_with("GET http://sui-transport.invalid/route "));
            assert_eq!(cache.generation, 1);
            cache.get(&custom).unwrap();
            assert_eq!(cache.generation, 1);
            let (target, hit) = probe();
            cache
                .get(&direct)
                .unwrap()
                .get(format!("{target}/direct"))
                .send()
                .await
                .unwrap();
            assert!(hit.join().unwrap().starts_with("GET /direct "));
            assert_eq!(cache.generation, 2);
            let excluded = ProxySettings {
                address: Some("http://127.0.0.1:1".into()),
                exclusions: "127.0.0.1".into(),
                ..Default::default()
            };
            let (target, hit) = probe();
            cache
                .get(&excluded)
                .unwrap()
                .get(format!("{target}/excluded"))
                .send()
                .await
                .unwrap();
            assert!(hit.join().unwrap().starts_with("GET /excluded "));
            assert_eq!(cache.generation, 3);
        });
    }

    #[test]
    fn never_follows_verification_redirects() {
        tauri::async_runtime::block_on(async {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let url = format!("http://{}", listener.local_addr().unwrap());
            let server = thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                let mut buffer = [0; 4096];
                stream.read(&mut buffer).unwrap();
                stream.write_all(b"HTTP/1.1 302 Found\r\nLocation: https://sorry.google.com/\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
            });
            let response = ProxySettings::default()
                .client()
                .unwrap()
                .get(&url)
                .send()
                .await
                .unwrap();
            assert_eq!(response.status(), 302);
            assert_eq!(response.url().as_str(), format!("{url}/"));
            server.join().unwrap();
        });
    }
}
