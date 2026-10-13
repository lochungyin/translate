use crate::config::{get, set};
use crate::window::{input_translate, ocr_recognize, ocr_translate, selection_translate};
use crate::APP;
use log::{info, warn};
use tauri::{AppHandle, GlobalShortcutManager};

fn register<F>(app_handle: &AppHandle, name: &str, handler: F, key: &str) -> Result<(), String>
where
    F: Fn() + Send + 'static,
{
    let hotkey = {
        if key.is_empty() {
            match get(name) {
                Some(v) => v.as_str().unwrap().to_string(),
                None => {
                    set(name, "");
                    String::new()
                }
            }
        } else {
            key.to_string()
        }
    };

    if !hotkey.is_empty() {
        match app_handle
            .global_shortcut_manager()
            .register(hotkey.as_str(), handler)
        {
            Ok(()) => {
                info!("Registered global shortcut: {} for {}", hotkey, name);
            }
            Err(e) => {
                warn!("Failed to register global shortcut: {} {:?}", hotkey, e);
                return Err(e.to_string());
            }
        };
    }
    Ok(())
}

// Register global shortcuts
pub fn register_shortcut(shortcut: &str) -> Result<(), String> {
    let app_handle = APP.get().unwrap();
    match shortcut {
        "hotkey_selection_translate" => register(
            app_handle,
            "hotkey_selection_translate",
            selection_translate,
            "",
        )?,
        "hotkey_input_translate" => {
            register(app_handle, "hotkey_input_translate", input_translate, "")?
        }
        "hotkey_ocr_recognize" => register(app_handle, "hotkey_ocr_recognize", ocr_recognize, "")?,
        "hotkey_ocr_translate" => register(app_handle, "hotkey_ocr_translate", ocr_translate, "")?,
        "all" => {
            let actions: [(&str, fn()); 4] = [
                ("hotkey_selection_translate", selection_translate),
                ("hotkey_input_translate", input_translate),
                ("hotkey_ocr_recognize", ocr_recognize),
                ("hotkey_ocr_translate", ocr_translate),
            ];
            let errors: Vec<String> = actions
                .into_iter()
                .filter_map(|(name, handler)| {
                    register(app_handle, name, handler, "")
                        .err()
                        .map(|error| format!("{name}: {error}"))
                })
                .collect();
            if !errors.is_empty() {
                return Err(errors.join("\n"));
            }
        }
        _ => {}
    }
    Ok(())
}

#[tauri::command]
pub fn register_shortcut_by_frontend(name: &str, shortcut: &str) -> Result<(), String> {
    use tauri::Manager;
    let app = APP.get().unwrap();
    let handler: fn() = match name {
        "hotkey_selection_translate" => selection_translate,
        "hotkey_input_translate" => input_translate,
        "hotkey_ocr_recognize" => ocr_recognize,
        "hotkey_ocr_translate" => ocr_translate,
        _ => return Err("Unknown shortcut action".into()),
    };
    let old = get(name)
        .and_then(|v| v.as_str().map(str::to_owned))
        .unwrap_or_default();
    let mut manager = app.global_shortcut_manager();
    if old == shortcut && (shortcut.is_empty() || manager.is_registered(shortcut).unwrap_or(false))
    {
        return Ok(());
    }
    // Register the replacement first. An invalid/conflicting key preserves the old binding.
    if !shortcut.is_empty() {
        manager
            .register(shortcut, handler)
            .map_err(|e| e.to_string())?;
    }
    if !old.is_empty() && old != shortcut && manager.is_registered(&old).unwrap_or(false) {
        if let Err(error) = manager.unregister(&old) {
            if !shortcut.is_empty() {
                let _ = manager.unregister(shortcut);
            }
            return Err(error.to_string());
        }
    }
    set(name, shortcut);
    app.emit_all(&format!("{name}_changed"), shortcut)
        .map_err(|e| e.to_string())?;
    Ok(())
}
