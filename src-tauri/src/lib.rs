use tauri::Manager;
use std::sync::{Mutex, Arc, atomic};
use rusqlite::Connection;
use whisper_rs::{WhisperContext, WhisperContextParameters};

/// Déclaration des modules internes
mod audio;
mod history;
mod models;
mod settings;
mod errors;
mod updater;

/// Structure WhisperPool qui représente un "pool" de contextes Whisper
pub struct WhisperPool {
    pub contexts: Vec<Arc<Mutex<WhisperContext>>>,
}

/// Implémentation du pool
impl WhisperPool {
    /// Constructeur du pool
    ///
    /// # Arguments
    /// * `model_path` - chemin vers le modèle Whisper (.bin)
    /// * `size` - nombre de contextes à créer
    /// 
    /// # Returns
    /// Le pool construit
    /// 
    /// # Errors
    /// Retourne une erreur si un contexte échoue
    pub fn new(model_path: &str, size: usize) -> Result<Self, String> {
        // création de "size" contextes Whisper
        let contexts = (0..size)
            .map(|_| {
                WhisperContext::new_with_params(
                    model_path,
                    WhisperContextParameters::default(),
                )
                .map(|ctx| Arc::new(Mutex::new(ctx)))
                .map_err(|e| e.to_string())
            })
            .collect::<Result<Vec<_>, _>>()?; // Transforme l'itérateur en Vec

        Ok(Self { contexts })
    }

    /// Acquisition d'un contexte libre
    /// 
    /// Tente de trouver un WhisperContext non utilisé
    /// 
    /// # Returns
    /// Some((index, guard)) ou None
    pub fn acquire(&self) -> Option<(usize, std::sync::MutexGuard<'_, WhisperContext>)> {
        for (i, ctx) in self.contexts.iter().enumerate() {
            if let Ok(guard) = ctx.try_lock() {
                return Some((i, guard));
            }
        }
        None
    }
}

/// Etat global de l'application
pub struct AppState {
    pub whisper_ctx: Mutex<Option<WhisperContext>>, // Contexte Whisper unique
    pub loaded_model: Mutex<Option<String>>,        // Nom du modèle actuellement chargé
    pub whisper_pool: Mutex<Option<WhisperPool>>,   // Pool de contextes Whisper
    pub pool_model: Mutex<Option<String>>,          // Modèle actuellement chargé dans le pool
    pub threads_per_segment: Mutex<i32>,            // Nombre de threads utilisés par segment audio
    pub cpu_usage: Mutex<u32>,                      // Pourcentage CPU choisi par l'utilisateur
    pub db: Mutex<Connection>,                      // Connexion SQLite partagée
    pub is_transcribing: Mutex<bool>,               // Verrou contre les transcriptions concurrentes
    pub is_cancelled: Arc<atomic::AtomicBool>,      // Annulation d'une transcription en cours
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Initialisation du modèle par défaut
            models::init_default_model(&app.handle())
                .expect("Impossible d'initialiser le modèle par défaut");

            // Initialisation de la base SQLite
            let conn = history::init_database(&app.handle())
                .expect("Impossible d'initialiser la base de données");

            // Injection de l'état global
            app.manage(AppState {
                whisper_ctx: Mutex::new(None),
                loaded_model: Mutex::new(None),
                whisper_pool: Mutex::new(None),
                pool_model:   Mutex::new(None),
                threads_per_segment: Mutex::new(1), // 1 thread par segment
                cpu_usage: Mutex::new(75),          // Utilisation du CPU à 75%
                db: Mutex::new(conn),               // Stockage de la connexion SQLite
                is_transcribing: Mutex::new(false), // Aucune transcription en cours
                is_cancelled: Arc::new(atomic::AtomicBool::new(false)), // Aucune annulation
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init()) // Ouverture des fichiers/URLs
        .plugin(tauri_plugin_dialog::init()) // Boîtes de dialogue natives
        .plugin(tauri_plugin_shell::init())  // Exécution de commandes shell
        .plugin(tauri_plugin_store::Builder::default().build()) // Stockage persistant clé/valeur
        .plugin(tauri_plugin_http::init())   // Requêtes HTTP
        .plugin(tauri_plugin_updater::Builder::new().build()) // Détection de mise à jour
        // Commandes exposées au frontend
        .invoke_handler(tauri::generate_handler![
            // Audio
            audio::transcribe_audio,
            audio::transcribe_chunk,
            audio::cancel_transcription,
            // Settings
            settings::get_selected_model,
            settings::set_selected_model,
            settings::get_cpu_usage,
            settings::set_cpu_usage,
            // Models
            models::get_available_models,
            models::download_model,
            models::delete_model,
            // History
            history::save_transcription,
            history::get_transcriptions,
            history::update_transcription,
            history::delete_transcription,
            history::get_audio_base64,
            history::export_as_txt,
            history::export_as_srt,
            history::get_history_stats,
            // Updater
            updater::check_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}