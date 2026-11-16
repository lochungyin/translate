use crate::{error::Error, APP};
use dirs::config_dir;
use log::{info, warn};
use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::{Manager, Wry};
use tauri_plugin_store::{Store, StoreBuilder};

pub struct StoreWrapper(pub Mutex<Store<Wry>>);

pub fn init_config(app: &mut tauri::App) {
    let config_path = config_dir().unwrap();
    let config_path = config_path.join(app.config().tauri.bundle.identifier.clone());
    let config_path = config_path.join("config.json");
    info!("Load config from: {:?}", config_path);
    let mut store = StoreBuilder::new(app.handle(), config_path).build();

    match load_config(&mut store) {
        Ok(_) => info!("Config loaded"),
        Err(e) => {
            warn!("Config load error: {:?}", e);
            info!("Config not found, creating new config");
        }
    }
    app.manage(StoreWrapper(Mutex::new(store)));
    init_personal_defaults();
    let _ = check_service_available();
}

fn strip_legacy_youdao_credentials(key: &str, value: &mut Value) -> bool {
    if key.split('@').next() != Some("youdao") {
        return false;
    }
    let Some(config) = value.as_object_mut() else {
        return false;
    };
    let app_id = config.remove("appkey");
    let secret = config.remove("key");
    app_id.is_some() || secret.is_some()
}

fn load_config(store: &mut Store<Wry>) -> Result<(), tauri_plugin_store::Error> {
    store.load()?;
    let cleaned: Vec<_> = store
        .entries()
        .filter(|(key, _)| key.split('@').next() == Some("youdao"))
        .filter_map(|(key, value)| {
            let mut value = value.clone();
            strip_legacy_youdao_credentials(key, &mut value).then(|| (key.clone(), value))
        })
        .collect();
    if !cleaned.is_empty() {
        for (key, value) in cleaned {
            store.insert(key, value)?;
        }
        store.save()?;
    }
    Ok(())
}

#[tauri::command]
pub fn reload_store() -> Result<(), String> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    load_config(&mut store).map_err(|e| e.to_string())
}

fn check_available(list: Vec<String>, builtin: Vec<&str>, plugin: Vec<String>, key: &str) {
    let origin_length = list.len();
    let mut new_list = list.clone();
    for service in list {
        let name = service.split("@").collect::<Vec<&str>>()[0];
        let mut is_available = true;
        if name.starts_with("plugin") {
            if !plugin.contains(&name.to_string()) {
                is_available = false;
            }
        } else {
            if !builtin.contains(&name) {
                is_available = false;
            }
        }
        if !is_available {
            new_list.retain(|x| x != &service);
        }
    }
    if new_list.len() != origin_length {
        set(key, new_list);
    }
}

pub fn check_service_available() -> Result<(), Error> {
    let builtin_recognize_list: Vec<&str> = vec!["system", "tesseract", "qrcode"];
    let builtin_translate_list: Vec<&str> = vec!["google", "youdao"];
    let builtin_tts_list: Vec<&str> = vec!["google_tts"];
    let builtin_collection_list: Vec<&str> = vec!["anki", "eudic"];

    let plugin_recognize_list: Vec<String> = get_plugin_list("recognize").unwrap_or_default();
    let plugin_translate_list: Vec<String> = get_plugin_list("translate").unwrap_or_default();
    let plugin_tts_list: Vec<String> = get_plugin_list("tts").unwrap_or_default();
    let plugin_collection_list: Vec<String> = get_plugin_list("collection").unwrap_or_default();
    if let Some(recognize_service_list) = get("recognize_service_list") {
        let recognize_service_list: Vec<String> = serde_json::from_value(recognize_service_list)?;
        check_available(
            recognize_service_list,
            builtin_recognize_list,
            plugin_recognize_list,
            "recognize_service_list",
        );
    }
    if let Some(translate_service_list) = get("translate_service_list") {
        let translate_service_list: Vec<String> = serde_json::from_value(translate_service_list)?;
        check_available(
            translate_service_list,
            builtin_translate_list,
            plugin_translate_list,
            "translate_service_list",
        );
    }
    if let Some(tts_service_list) = get("tts_service_list") {
        let tts_service_list: Vec<String> = serde_json::from_value(tts_service_list)?;
        check_available(
            tts_service_list,
            builtin_tts_list,
            plugin_tts_list,
            "tts_service_list",
        );
    }
    if let Some(collection_service_list) = get("collection_service_list") {
        let collection_service_list: Vec<String> = serde_json::from_value(collection_service_list)?;
        check_available(
            collection_service_list,
            builtin_collection_list,
            plugin_collection_list,
            "collection_service_list",
        );
    }
    Ok(())
}

pub fn get_plugin_list(plugin_type: &str) -> Option<Vec<String>> {
    let app_handle = APP.get().unwrap();
    let config_dir = dirs::config_dir()?;
    let config_dir = config_dir.join(app_handle.config().tauri.bundle.identifier.clone());
    let plugin_dir = config_dir.join("plugins");
    let plugin_dir = plugin_dir.join(plugin_type);

    // dirs in plugin_dir
    let mut plugin_list = vec![];
    if plugin_dir.exists() {
        let read_dir = std::fs::read_dir(plugin_dir).ok()?;
        for entry in read_dir {
            let entry = entry.ok()?;

            if entry.path().is_dir() {
                let name = entry.file_name().to_str()?.to_string();
                if name.starts_with("plugin") {
                    plugin_list.push(name);
                } else {
                    // Remove old plugin
                    let _ = std::fs::remove_dir_all(entry.path());
                }
            }
        }
    }
    Some(plugin_list)
}

pub fn get(key: &str) -> Option<Value> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let store = state.0.lock().unwrap();
    match store.get(key) {
        Some(value) => Some(value.clone()),
        None => None,
    }
}

pub fn set<T: serde::ser::Serialize>(key: &str, value: T) {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().unwrap();
    store.insert(key.to_string(), json!(value)).unwrap();
    store.save().unwrap();
}

fn init_personal_defaults() {
    let defaults = json!({
        "app_language": "zh_cn",
        "app_theme": "system",
        "app_font_size": 14,
        "transparent": false,
        "check_update": false,
        "server_port": 60829,
        "translate_service_list": ["google", "youdao"],
        "recognize_service_list": ["system", "tesseract"],
        "tts_service_list": ["google_tts"],
        "google": {"custom_url": "https://translate.google.com"},
        "youdao": {},
        "translate_detect_engine": "local",
        "translate_window_width": 440,
        "translate_window_height": 600,
        "hotkey_selection_translate": "Alt+D",
        "hotkey_input_translate": "Alt+A",
        "hotkey_ocr_translate": "Alt+S",
        "hotkey_ocr_recognize": "Alt+O"
    });
    for (key, value) in defaults.as_object().unwrap() {
        if get(key).is_none() {
            set(key, value);
        }
    }
}

#[tauri::command]
pub fn get_config_value(key: String) -> Option<Value> {
    get(&key)
}

#[tauri::command]
pub fn has_config_value(key: String) -> bool {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let store = state.0.lock().unwrap();
    store.has(key)
}

#[tauri::command]
pub fn set_config_value(key: String, mut value: Value) -> Result<(), String> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    strip_legacy_youdao_credentials(&key, &mut value);
    store.insert(key, value).map_err(|e| e.to_string())?;
    store.save().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_config_value(key: String) -> Result<bool, String> {
    let state = APP.get().unwrap().state::<StoreWrapper>();
    let mut store = state.0.lock().map_err(|e| e.to_string())?;
    let deleted = store.delete(key).map_err(|e| e.to_string())?;
    store.save().map_err(|e| e.to_string())?;
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_cloud_credentials_only_from_builtin_youdao_instances() {
        let old = json!({
            "appkey": "retired-app-id",
            "key": "retired-secret",
            "instanceName": "My Youdao",
            "enable": false
        });
        for instance in ["youdao", "youdao@custom"] {
            let mut value = old.clone();
            assert!(strip_legacy_youdao_credentials(instance, &mut value));
            assert_eq!(value, json!({"instanceName": "My Youdao", "enable": false}));
            assert!(!strip_legacy_youdao_credentials(instance, &mut value));
        }
        for other in ["google", "plugin_youdao@example", "youdao_other"] {
            let mut value = old.clone();
            assert!(!strip_legacy_youdao_credentials(other, &mut value));
            assert_eq!(value, old);
        }
    }
}
