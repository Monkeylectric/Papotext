use tauri::Manager;
use rusqlite::Connection;
use crate::AppState;

/// Structure de la transcription
#[derive(serde::Serialize)]
pub struct Transcription {
    id: i64,            // ID unique auto-incrémenté SQLite
    filename: String,   // Nom du fichier audio transcrit
    text: String,       // Texte complet de la transcription
    model: String,      // Texte complet de la transcription
    created_at: String, // Date/heure de création
}

/// Initialisation de la base SQLite
/// 
/// # Arguments
/// * `app` - Handle Tauri
///
/// # Returns
/// La connexion à la base de données locale
///
/// # Errors
/// * Si le chemin vers la bdd est introuvable
/// * Si l'ouverture de la bdd échoue
/// * Si la création de la table échoue
pub fn init_database(app: &tauri::AppHandle) -> Result<Connection, String> {
    // Chemin de la base SQLite
    let db_path = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("transcriptions.db");

    // Ouverture de la connexion SQLite
    let conn = Connection::open(&db_path)
        .map_err(|e| e.to_string())?;

    // Création de la table si elle n'existe pas
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS transcriptions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT NOT NULL,
            text        TEXT NOT NULL,
            model       TEXT NOT NULL,
            created_at  TEXT NOT NULL
        );
    ").map_err(|e| e.to_string())?;

    Ok(conn)
}

/// Sauvegarde d'une transcription
/// 
/// # Arguments
/// * `state`    - État global de l'application
/// * `filename` - Nom du fichier audio
/// * `text`     - Texte transcrit
/// * `model`    - Modèle utilisé
///
/// # Errors
/// * Si le verouillage de la connexion échoue
/// * Si l'insertion en bdd échoue
#[tauri::command]
pub fn save_transcription(
    state: tauri::State<AppState>,
    filename: String,
    text: String,
    model: String,
) -> Result<(), String> {
    // Verrouillage de la connexion
    let db = state.db.lock()
        .map_err(|e| e.to_string())?;

    // Génération du timestamp
    let now = chrono::Local::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    // Insertion SQL
    db.execute(
        "INSERT INTO transcriptions (filename, text, model, created_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![filename, text, model, now],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Récupération de l'historique
/// 
/// # Arguments
/// * `state` - État global de l'application
/// 
/// # Returns
/// Les 50 dernières transcriptions
///
/// # Errors
/// * Si le verouillage de la connexion échoue
/// * Si la préparation de la requête échoue
/// * si l'exécution de la requête échoue
#[tauri::command]
pub fn get_transcriptions(state: tauri::State<AppState>) -> Result<Vec<Transcription>, String> {
    let db = state.db.lock()
        .map_err(|e| e.to_string())?;

    // Préparation de la requête SQL
    let mut stmt = db.prepare(
        "SELECT id, filename, text, model, created_at 
        FROM transcriptions 
        ORDER BY created_at DESC
        LIMIT 50"
    ).map_err(|e| e.to_string())?;

    // Exécution de la requête
    let transcriptions = stmt.query_map([], |row| {
        Ok(Transcription {
            id: row.get(0)?,
            filename: row.get(1)?,
            text: row.get(2)?,
            model: row.get(3)?,
            created_at: row.get(4)?,
        })
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok()) // Filtrage des erreurs éventuelles
    .collect();

    Ok(transcriptions)
}

/// Suppression d'une transcription
/// 
/// Supprime une entrée de l'historique par son ID
/// 
/// # Arguments
/// * `state` - État global de l'application
/// * `id`    - Identifiant de la transcription à supprimer
///
/// # Errors
/// * Si le verouillage de la connexion échoue
/// * si la suppression de la transcription échoue
#[tauri::command]
pub fn delete_transcription(
    state: tauri::State<AppState>, 
    id: i64
) -> Result<(), String> {
    let db = state.db.lock()
        .map_err(|e| e.to_string())?;

    db.execute(
        "DELETE FROM transcriptions WHERE id = ?1",
        rusqlite::params![id],
    ).map_err(|e| e.to_string())?;

    Ok(())
}