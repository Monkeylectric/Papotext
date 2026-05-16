/// Récupération du modèle sélectionné
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Returns
/// Le modèle Whisper actuellement configuré par l'utilisateur
/// 
/// # Example
/// * ggml-base.bin
/// * ggml-small.bin
/// * ggml-large-v3.bin
///
/// # Errors
/// Si l'ouverture du store échoue
#[tauri::command]
pub fn get_selected_model(app: tauri::AppHandle) -> Result<String, String> {
    // Ouverture du store persistant
    let store = tauri_plugin_store::StoreBuilder::new(&app, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    // Retourne le modèle sauvegardé, ou "ggml-small.bin" par défaut
    let model = store
        .get("selected_model")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "ggml-small.bin".to_string());

    Ok(model)
}

/// Sauvegarde du modèle sélectionné
/// 
/// Sauvegarde lorsque l'utilisateur change
/// le modèle dans l'interface
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Errors
/// * Si l'ouverture du store échoue
/// * Si la sauvegarde du modèle échoue
#[tauri::command]
pub fn set_selected_model(
    app: tauri::AppHandle, 
    model_name: String
) -> Result<(), String> {
    let store = tauri_plugin_store::StoreBuilder::new(&app, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    store.set("selected_model", serde_json::Value::String(model_name));
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}

/// Récupération de la limite CPU
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Returns
/// le pourcentage d'utilisation CPU 
/// configuré par l'utilisateur
/// 
/// # Examples
/// * 25  -> faible utilisation CPU
/// * 50  -> équilibré
/// * 75  -> performance élevée
/// * 100 -> utilisation maximale
/// 
/// # Errors
/// * Si l'ouverture du store échoue
#[tauri::command]
pub fn get_cpu_usage(app: tauri::AppHandle) -> Result<u32, String> {
    let store = tauri_plugin_store::StoreBuilder::new(&app, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    let value = store
        .get("cpu_usage")
        .and_then(|v| v.as_u64()) // Conversion JSON en u64
        .unwrap_or(75) as u32; // Conversion finale en u32

    Ok(value)
}

/// Sauvegarde de la limite CPU
/// 
/// Sauvegarde le pourcentage CPU 
/// choisi par l'utilisateur
/// 
/// # Arguments
/// * `app`   - Handle Tauri
/// * `value` - Valeur de la limite CPU
/// 
/// # Example
/// ```
/// set_cpu_usage(50)
/// ```
/// 
/// # Errors
/// * Si l'ouverture du store échoue
/// * Si la sauvegarde de la valeur échoue
#[tauri::command]
pub fn set_cpu_usage(
    app: tauri::AppHandle, 
    value: u32
) -> Result<(), String> {
    let store = tauri_plugin_store::StoreBuilder::new(&app, "settings.json")
        .build()
        .map_err(|e| e.to_string())?;

    store.set("cpu_usage", serde_json::Value::Number(value.into()));
    // Sauvegarde de la valeur CPU
    store.save().map_err(|e| e.to_string())?;

    Ok(())
}