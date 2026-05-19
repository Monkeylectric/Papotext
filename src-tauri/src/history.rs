use tauri::Manager;
use rusqlite::Connection;
use crate::AppState;

/// Nombre de transcriptions par page
const PAGE_SIZE: i64 = 20;

/// Structure de la transcription
#[derive(serde::Serialize)]
pub struct Transcription {
    id: i64,            // ID unique auto-incrémenté SQLite
    filename: String,   // Nom du fichier audio transcrit
    audio_path: Option<String>, // Chemin du fichier audio
    text: String,       // Texte complet de la transcription
    model: String,      // Texte complet de la transcription
    segments: Option<String>, // Segments des transcriptions (timestamps + texte)
    created_at: String, // Date/heure de création
}

/// Structure de la réponse paginée
#[derive(serde::Serialize)]
pub struct TranscriptionPage {
    items: Vec<Transcription>, // Transcriptions de la page courante
    total: i64,                // Nombre total de transcriptions
    page: i64,                 // Page courante (base 1)
    page_size: i64,            // Nombre d'éléments par page
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
    // conn.execute_batch("
    //     CREATE TABLE IF NOT EXISTS transcriptions (
    //         id          INTEGER PRIMARY KEY AUTOINCREMENT,
    //         filename    TEXT NOT NULL,
    //         text        TEXT NOT NULL,
    //         model       TEXT NOT NULL,
    //         created_at  TEXT NOT NULL
    //     );
    // ").map_err(|e| e.to_string())?;
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS transcriptions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            filename    TEXT NOT NULL,
            text        TEXT NOT NULL,
            model       TEXT NOT NULL,
            created_at  TEXT NOT NULL,
            segments    TEXT
        );
    ").map_err(|e| e.to_string())?;

    // Migration: ajoute les colonnes si elles n'existent pas encore
    let _ = conn.execute_batch("ALTER TABLE transcriptions ADD COLUMN segments TEXT;");
    let _ = conn.execute_batch("ALTER TABLE transcriptions ADD COLUMN audio_path TEXT;");

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
    audio_path: String,
    text: String,
    model: String,
    segments: Option<String>,
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
        "INSERT INTO transcriptions (filename, audio_path, text, model, created_at, segments) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![filename, audio_path, text, model, now, segments],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

/// Récupération de l'historique
/// 
/// # Arguments
/// * `state` - État global de l'application
/// * `page`  - Numéro de page demandé (base 1)
/// 
/// # Returns
/// Une page de transcriptions avec le total général
///
/// # Errors
/// * Si le verouillage de la connexion échoue
/// * Si la préparation de la requête échoue
/// * si l'exécution de la requête échoue
#[tauri::command]
pub fn get_transcriptions(
    state: tauri::State<AppState>,
    page: i64
) -> Result<TranscriptionPage, String> {
    let db = state.db.lock()
        .map_err(|e| e.to_string())?;

    // Une page minimum
    let page = page.max(1);
    let offset = (page - 1) * PAGE_SIZE;

    // Nombre total de transcriptions
    let total: i64 = db.query_row(
        "SELECT COUNT(*) FROM transcriptions",
        [],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

    // Requête paginée
    let mut stmt = db.prepare(
        "SELECT id, filename, audio_path, text, model, created_at, segments 
        FROM transcriptions 
        ORDER BY created_at DESC
        LIMIT ?1 OFFSET ?2"
    ).map_err(|e| e.to_string())?;

    // Exécution de la requête
    let items = stmt.query_map(rusqlite::params![PAGE_SIZE, offset], |row| {
        Ok(Transcription {
            id: row.get(0)?,
            filename: row.get(1)?,
            audio_path: row.get(2)?,
            text: row.get(3)?,
            model: row.get(4)?,
            created_at: row.get(5)?,
            segments: row.get(6)?,
        })
    })
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    Ok(TranscriptionPage {
        items,
        total,
        page,
        page_size: PAGE_SIZE,
    })
}

/// Mise à jour du texte d'une transcription
/// 
/// # Arguments
/// * `state` - État global de l'application
/// * `id`    - Identifiant de la transcription à modifier
/// * `text`  - Nouveau texte
///
/// # Errors
/// * Si le verouillage de la connexion échoue
/// * Si la mise à jour échoue
#[tauri::command]
pub fn update_transcription(
    state: tauri::State<AppState>,
    id: i64,
    text: String,
) -> Result<(), String> {
    let db = state.db.lock()
        .map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE transcriptions SET text = ?1 WHERE id = ?2",
        rusqlite::params![text, id],
    ).map_err(|e| e.to_string())?;

    Ok(())
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

#[tauri::command]
pub fn get_audio_base64(path: String) -> Result<String, String> {
    use std::io::Read;

    let mut file = std::fs::File::open(&path)
        .map_err(|_| "Fichier audio introuvable. Il a peut-être été déplacé ou supprimé.".to_string())?;

    let mut buf = Vec::new();
    file.read_to_end(&mut buf)
        .map_err(|e| e.to_string())?;

    // Détection du format pour le data URL
    let mime = if path.ends_with(".mp3") { "audio/mpeg" } else { "audio/wav" };

    Ok(format!("data:{};base64,{}", mime, base64_encode(&buf)))
}

/// Encodage base64 sans dépendance externe
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((data.len() + 2) / 3 * 4);

    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = if chunk.len() > 1 { chunk[1] as usize } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as usize } else { 0 };
        
        result.push(CHARS[(b0 >> 2)] as char);
        result.push(CHARS[((b0 & 3) << 4) | (b1 >> 4)] as char);
        result.push(if chunk.len() > 1 { CHARS[((b1 & 15) << 2) | (b2 >> 6)] as char } else { '=' });
        result.push(if chunk.len() > 2 { CHARS[b2 & 63] as char } else { '=' });
    }
    result
}