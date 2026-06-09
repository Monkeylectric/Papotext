use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
pub async fn check_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let update = app.updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    Ok(update.map(|u| u.version.to_string()))
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let update = app.updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(update) = update {
        update.download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}