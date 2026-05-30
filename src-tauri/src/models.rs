use tauri::Manager;
use tauri::Emitter;
use tauri_plugin_http::reqwest;
use crate::errors::{err, err_detail};

/// Récupération du dossier local des modèles
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Returns
/// Le chemin du dossier où sont stockés les modèles
/// 
/// # Example
/// * Windows : AppData/Local/<app>/models
/// * Linux : ~/.local/share/<app>/models
/// * macOS : ~/Library/Application Support/<app>/models
///
/// # Errors
/// * Si la récupération du chemin échoue
/// * Si la création du dossier échoue
pub fn get_models_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    // Récupère le dossier local de l'application
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");

    // Crée le dossier s'il n'existe pas
    std::fs::create_dir_all(&dir)
        .map_err(|e| e.to_string())?;

    Ok(dir)
}

/// Initialisation du modèle Whisper par défaut
/// 
/// Au premier lancement de l'application,
/// copie automatiquement un modèle embarqué
/// dans le dossier local
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Errors
/// * Si la récupération du chemin échoue
/// * Si la copie du modèle échoue
pub fn init_default_model(app: &tauri::AppHandle) -> Result<(), String> {
    // Dossier local des modèles
    let models_dir = get_models_dir(app)?;
    // Chemin final du modèle par défaut
    let dest = models_dir.join("ggml-small.bin");

    // Copier seulement si le modèle n'existe pas déjà
    if !dest.exists() {
        // Chemin du modèle embarqué
        let src = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("models")
            .join("ggml-small.bin");

        // Copie du modèle
        std::fs::copy(&src, &dest)
            //.map_err(|e| format!("Impossible de copier le modèle par défaut : {}", e))?;
            .map_err(|e| err_detail("error.model.copy", &e.to_string()))?;
    }

    Ok(())
}

/// Liste des modèles disponibles
/// 
/// # Arguments
/// * `app` - Handle Tauri
/// 
/// # Returns
/// Tous les fichiers .bin présents dans le dossier models
///
/// # Errors
/// * Si le parcours des fichiers du dossier échoue
/// * Si la copie du modèle échoue
#[tauri::command]
pub fn get_available_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let models_dir = get_models_dir(&app)?;
    
    // Tableau des noms de modèles
    let mut models = Vec::new();

    // Parcours les fichiers du dossier
    for entry in std::fs::read_dir(&models_dir)
        .map_err(|e| e.to_string())?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        // Filtre uniquement les fichiers .bin
        if path.extension().and_then(|e| e.to_str()) == Some("bin") {
            // Récupère le nom du fichier
            if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                models.push(filename.to_string());
            }
        }
    }

    Ok(models)
}

/// Téléchargement d'un modèle
/// 
/// Télécharge un modèle Whisper depuis HuggingFace
/// 
/// # Arguments
/// * `app`        - Handle Tauri
/// * `model_name` - Nom du modèle à téléchargé
///
/// # Errors
/// Si le téléchargement du modèle échoue
#[tauri::command]
pub async fn download_model(
    app: tauri::AppHandle, 
    model_name: String
) -> Result<(), String> {
    // Construction de l'URL de téléchargement
    let url = format!(
        "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/{}",
        model_name
    );

    // Chemin de destination local
    let dest_path = get_models_dir(&app)?
        .join(&model_name);

    // Lancer la requête HTTP
    let client = reqwest::Client::new();
    let mut response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Taille totale du fichier
    let total_size = response
        .content_length()
        .unwrap_or(0);

    // Création du fichier local
    let mut file = std::fs::File::create(&dest_path)
        .map_err(|e| e.to_string())?;

    // Nombre total d'octets téléchargés
    let mut downloaded: u64 = 0;

    // Téléchargement par morceaux
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| e.to_string())?
    {
        // Ecriture du chunk sur le disque
        std::io::Write::write_all(&mut file, &chunk)
            .map_err(|e| e.to_string())?;

        // Mise à jour de la progression
        downloaded += chunk.len() as u64;

        // Calcul du pourcentage
        let progress = if total_size > 0 {
            (downloaded as f64 / total_size as f64 * 100.0) as u32
        } else {
            0
        };

        // Envoie de la progression au frontend
        app.emit("download_progress", progress)
            .map_err(|e| e.to_string())?;
    }

    // Signaler que le téléchargement est terminé
    app.emit("download_complete", &model_name)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Suppression d'un modèle
/// 
/// # Arguments
/// * `app`        - Handle Tauri
/// * `model_name` - Nom du modèle à téléchargé
///
/// # Errors
/// Si la suppression du modèle échoue
#[tauri::command]
pub fn delete_model(
    app: tauri::AppHandle, 
    model_name: String
) -> Result<(), String> {
    // Protection du modèle par défaut
    if model_name == "ggml-small.bin" {
        //return Err("Impossible de supprimer le modèle par défaut".to_string());
        return Err(err("error.model.delete_default"));
    }

    let model_path = get_models_dir(&app)?.join(&model_name);

    // Vérifie que le fichier existe
    if !model_path.exists() {
        //return Err("Modèle introuvable".to_string());
        return Err(err("error.model.not_found"));
    }

    // Suppression du fichier
    std::fs::remove_file(&model_path)
        .map_err(|e| e.to_string())?;

    Ok(())
}