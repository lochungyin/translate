use crate::window::text_translate;
use std::sync::Mutex;
use tauri::{ClipboardManager, Manager};

pub struct ClipboardMonitorEnableWrapper(pub Mutex<String>);

pub fn start_clipboard_monitor(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut pre_text = app_handle
            .clipboard_manager()
            .read_text()
            .ok()
            .flatten()
            .unwrap_or_default();
        loop {
            let state = app_handle.state::<ClipboardMonitorEnableWrapper>();
            let enabled = state
                .0
                .lock()
                .map(|value| value.as_str() == "true")
                .unwrap_or(false);
            // Release the monitor mutex before window creation (which waits on the main thread).
            if let Ok(Some(text)) = app_handle.clipboard_manager().read_text() {
                if enabled && !text.trim().is_empty() && text != pre_text {
                    text_translate(text.clone());
                }
                pre_text = text;
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    });
}

#[tauri::command]
pub fn set_clipboard_monitor(app_handle: tauri::AppHandle, enabled: bool) {
    crate::config::set("clipboard_monitor", enabled);
    let state = app_handle.state::<ClipboardMonitorEnableWrapper>();
    *state.0.lock().unwrap() = enabled.to_string();
    let _ = app_handle
        .tray_handle()
        .get_item("clipboard_monitor")
        .set_selected(enabled);
    let _ = app_handle.emit_all("clipboard_monitor_changed", enabled);
}
