use tauri::Emitter;
use tauri_plugin_shell::ShellExt;
use std::path::PathBuf;
use whisper_rs::{
    FullParams, 
    SamplingStrategy, 
    WhisperContext, 
    WhisperContextParameters
};
use futures::StreamExt;
use crate::AppState;
use crate::WhisperPool;
use crate::models::get_models_dir;
use crate::settings::get_selected_model;
use crate::history::save_transcription;

/// Gestion automatique des fichiers temporaires
struct TempFiles {
    // Liste des fichiers à supprimer automatiquement.
    paths: Vec<std::path::PathBuf>,
}

impl TempFiles {
    fn new(paths: Vec<std::path::PathBuf>) -> Self {
        Self { paths }
    }
}

/// RAII cleanup automatique
impl Drop for TempFiles {
    fn drop(&mut self) {
        // Supprime chaque fichier.
        for path in &self.paths {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Pipeline principal pour les fichiers complets
fn audio_filters_full() -> String {
    [
        "highpass=f=80",  // Coupe les fréquences très basses
        "lowpass=f=8000", // Coupe les très hautes fréquences
        "afftdn=nf=-25",  // Réduction de bruit fréquentielle
        "acompressor=threshold=-20dB:ratio=4:attack=5:release=50", // Homogénéise le volume de la voix
        "loudnorm",      // Normalisation du volume
        //"silenceremove=start_periods=1:start_threshold=-50dB:stop_periods=1:stop_threshold=-50dB", // suppression automatique des silences
    ].join(",")
}

/// Pipeline pour les segments audio
fn audio_filters_segments() -> String {
    [
        "highpass=f=80",
        "lowpass=f=8000",
        "afftdn=nf=-25",
        "acompressor=threshold=-20dB:ratio=4:attack=5:release=50",
        "loudnorm",
    ].join(",")
}

/// Pipeline léger pour le temps réel
fn audio_filters_realtime() -> String {
    [
        "highpass=f=80",
        "lowpass=f=8000",
        "acompressor=threshold=-20dB:ratio=4:attack=5:release=50",
        "loudnorm",
    ].join(",")
}

/// Alias de type
/// 
/// # Returns
/// Result<(index_segment, texte), erreur>
type SegmentResult = tokio::task::JoinHandle<Result<(usize, String), String>>;

/// Conversion audio vers WAV mono 16kHz
/// 
/// # Arguments
/// * `input` - Chemin vers le fichier source
/// * `app`   - Handle Tauri pour accéder au sidecar ffmpeg
/// 
/// # Returns
/// Le chemin vers le fichier WAV temporaire généré
/// 
/// # Errors
/// Retourne une erreur si ffmpeg échoue ou si le chemin est invalide
pub async fn convert_to_wav_16k(
    input: &str, 
    app: &tauri::AppHandle
) -> Result<PathBuf, String> {
    // Dossier temporaire système (cross-platform)
    let temp_dir = std::env::temp_dir();

    // Création d'un nom unique basé sur le timestamp pour éviter les conflits
    let filename = format!(
        "transcription_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    );

    // Chemin final du fichier converti
    let output = temp_dir.join(&filename);

    let output_str = output.to_str()
        .ok_or("chemin temporaire invalide")?
        .to_string();

    // Pipeline de filtres audio
    let audio_filters = audio_filters_full();

    // Lance ffmpeg embarqué
    let ffmpeg = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-i", input,    // Fichier source
            "-ar", "16000", // Fréquence d'échantillonnage 16000 Hz (requis par Whisper)
            "-ac", "1",     // Mono (1 canal)
            "-af", &audio_filters, // Filtres audio
            "-y",           // Écrase si le fichier existe déjà
            &output_str,    // Fichier de sortie
        ]);

    let ffmpeg_result = ffmpeg.output()
        .await
        .map_err(|e| e.to_string())?;

    // Vérifier que ffmpeg a réussi
    if !ffmpeg_result.status.success() {
        return Err(format!(
            "ffmpeg a échoué : {}",
        String::from_utf8_lossy(&ffmpeg_result.stderr)));
    }

    Ok(output)
}

/// Lecture de la durée totale du fichier audio
/// 
/// # Arguments
/// * `input` - Chemin vers le fichier source
/// * `app`   - Handle Tauri pour accéder au sidecar ffmpeg
/// 
/// # Returns
/// La durée du fichier audio
/// 
/// # Errors
/// Retourne une erreur si ffmpeg échoue ou si le chemin est invalide
async fn get_duration(
    input: &str, 
    app: &tauri::AppHandle
) -> Result<f64, String> {
    let result = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args(["-i", input, "-f", "null", "-"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stderr = String::from_utf8_lossy(&result.stderr);

    // Format : "Duration: HH:MM:SS.ms"
    for line in stderr.lines() {
        if line.contains("Duration:") {
            if let Some(dur) = line.split("Duration:").nth(1)
                .and_then(|s| s.split(',').next())
                .map(|s| s.trim())
            {
                let parts: Vec<&str> = dur.split(':').collect();
                if parts.len() == 3 {
                    let h: f64 = parts[0].parse().unwrap_or(0.0);
                    let m: f64 = parts[1].parse().unwrap_or(0.0);
                    let s: f64 = parts[2].parse().unwrap_or(0.0);

                    return Ok(h * 3600.0 + m * 60.0 + s);
                }
            }
        }
    }

    Err("impossible de lire la durée".to_string())
}

/// Détection des silences
/// 
/// # Arguments
/// * `input` - Chemin vers le fichier source
/// * `app`   - Handle Tauri pour accéder au sidecar ffmpeg
/// 
/// # Returns
/// Les timestamps des silences dans le fichier
/// 
/// # Errors
/// Retourne une erreur si ffmpeg échoue
async fn detect_splits(
    input: &str, 
    app: &tauri::AppHandle
) -> Result<Vec<f64>, String> {
    let result = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-i", input, 
            // Détection des silences
            "-af", "silencedetect=noise=-30dB:duration=0.5", 
            "-f", "null", 
            "-"
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stderr = String::from_utf8_lossy(&result.stderr);
    // Premier split toujours à 0
    let mut splits = vec![0.0f64];

    // Parse les timestamps de silence_end
    for line in stderr.lines() {
        if line.contains("silence_end") {
            if let Some(ts) = line.split("silence_end:").nth(1)
                .and_then(|s| s.split('|').next())
                .and_then(|s| s.trim().parse::<f64>().ok())
            {
                splits.push(ts);
            }
        }
    }

    Ok(splits)
}

/// Construction des segments audio
/// Créée des segments (~30s max) en essayant de couper sur les silences
/// 
/// # Arguments
/// * `splits`   - Tableau des timestamps des silences du fichier
/// * `total`    - Durée total du fichier
/// * `max_secs` - Maximum de secondes du segment à ne pas dépasser
/// 
/// # Returns
/// Les segments de type Vec<(début, fin)>
fn build_segments(
    splits: Vec<f64>, 
    total: f64, 
    max_secs: f64
) -> Vec<(f64, f64)> {
    let mut segments = Vec::new();
    let mut start = 0.0f64;

    for &split in &splits[1..] {
        // Si le segment dépasse max_secs on coupe ici
        if split - start >= max_secs {
            segments.push((start, split));
            start = split;
        }
    }

    // Ajoute le dernier segment
    if start < total {
        segments.push((start, total));
    }

    // Fallback : pas de silence détecté, un seul segment (tout le fichier)
    if segments.is_empty() {
        segments.push((0.0, total));
    }

    segments
}

/// Chargement du pool Whisper
/// 
/// Charge plusieurs contextes Whisper 
/// pour permettre la transcription parallèle
/// 
/// # Arguments
/// * `app`   - Handle Tauri
/// * `state` - État global de l'application
/// 
/// # Errors
/// Retourne une erreur si le stockage dans l'état échoue
fn load_pool(
    app: &tauri::AppHandle,
    state: &tauri::State<AppState>,
) -> Result<(), String> {
    // Récupère le modèle sélectionné
    let selected_model = get_selected_model(app.clone())
        .unwrap_or_else(|_| "ggml-small.bin".to_string());

    let current_cpu = crate::settings::get_cpu_usage(app.clone())
        .unwrap_or(75);

    let mut pool_lock  = state.whisper_pool.lock().map_err(|e| e.to_string())?;
    let mut model_lock = state.pool_model.lock().map_err(|e| e.to_string())?;
    let mut cpu_lock    = state.cpu_usage.lock().map_err(|e| e.to_string())?;

    // Vérifie si rechargement nécessaire
    let need_reload = match model_lock.as_deref() {
        Some(loaded) => loaded != selected_model,
        None => true,
    } || *cpu_lock != current_cpu;

    if need_reload {
        // Construit le chemin complet du modèle
        let model_path = get_models_dir(app)?
            .join(&selected_model)
            .to_str()
            .ok_or("chemin invalide")?
            .to_string();

        // Nombre total de threads CPU disponibles
        let total_threads = std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(4);

        // Récupérer le pourcentage CPU choisi par l'utilisateur
        let cpu_percent = crate::settings::get_cpu_usage(app.clone())
            .unwrap_or(75) as f64 / 100.0;

        // Taille maximale du pool
        let usable_threads = ((total_threads as f64 * cpu_percent) as usize).max(1);
        let pool_size = usable_threads.min(4);
        let threads_per_segment = (usable_threads / pool_size).max(1) as i32;

        // Stocker dans AppState
        let mut tps_lock = state.threads_per_segment.lock()
            .map_err(|e| e.to_string())?;
        
        *tps_lock = threads_per_segment;

        // Création du pool Whisper
        let pool = WhisperPool::new(&model_path, pool_size)?;

        *pool_lock = Some(pool); // Remplacement du pool actuel
        *model_lock = Some(selected_model); // Sauvegarde du modèle chargé
        *cpu_lock = current_cpu; // Sauvegarde du pourcentage cpu
    }

    Ok(())
}

/// Transcrit un segment audio en texte via Whisper
///
/// Extrait d'abord le segment du fichier source avec ffmpeg (conversion en WAV 16kHz mono),
/// puis exécute la transcription Whisper dans un thread bloquant dédié pour ne pas
/// bloquer le runtime Tokio
///
/// Le contexte Whisper est acquis uniquement dans `spawn_blocking` pour éviter
/// les contraintes `Send` liées au `MutexGuard`
///
/// # Arguments
/// * `input`               - Chemin vers le fichier audio source complet
/// * `start`               - Timestamp de début du segment en secondes
/// * `duration`            - Durée du segment en secondes
/// * `index`               - Index du segment (utilisé pour nommer le fichier temporaire)
/// * `app`                 - Handle Tauri pour accéder au sidecar ffmpeg
/// * `ctx_arc`             - Contexte Whisper partagé via `Arc<Mutex<_>>`
/// * `translate`           - Si `true`, traduit le résultat en anglais
/// * `threads_per_segment` - Nombre de threads CPU alloués à ce segment
///
/// # Returns
/// Le texte transcrit, nettoyé des espaces superflus
///
/// # Errors
/// * Si ffmpeg échoue à extraire ou convertir le segment
/// * Si la lecture du fichier WAV temporaire échoue
/// * Si la transcription Whisper échoue
/// * Si le thread `spawn_blocking` panique
async fn transcribe_segment_async(
    input: &str,
    start: f64,
    duration: f64,
    index: usize,
    app: &tauri::AppHandle,
    ctx_arc: std::sync::Arc<std::sync::Mutex<WhisperContext>>,
    translate: bool,
    threads_per_segment: i32,
) -> Result<String, String> {
    // Création du fichier temporaire
    let temp_path = std::env::temp_dir()
        .join(format!("segment_{}_{}.wav", index, start as u64));

    // Nettoyage automatique
    let _guard = TempFiles::new(vec![temp_path.clone()]);
    // Pipeline audio
    let filters = audio_filters_segments();
    let temp_str = temp_path.to_str().ok_or("chemin invalide")?.to_string();

    // Extraction du segment avec FFmpeg
    let ffmpeg_result = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-ss", &start.to_string(),    // Début du segment
            "-t",  &duration.to_string(), // Durée du segment
            "-i",  input,
            "-ar", "16000",               // Conversion Whisper
            "-ac", "1",
            "-af", &filters,
            "-y",
            &temp_str,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !ffmpeg_result.status.success() {
        return Err(format!("ffmpeg segment {} échoué", index));
    }

    let temp_path_clone = temp_path.clone();

    // Travail CPU-bound, évite de bloquer le runtile async Tokio
    tokio::task::spawn_blocking(move || {
        let ctx = ctx_arc.lock()
            .map_err(|e| e.to_string())?;

        // Lecture du WAV
        let mut reader = hound::WavReader::open(&temp_path_clone)
            .map_err(|e| e.to_string())?;

        // Conversion car Whisper attend une valeur entre -1.0 et 1.0
        let samples: Vec<f32> = reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / 32768.0))
            .collect::<Result<Vec<f32>, _>>()
            .map_err(|e| e.to_string())?;

        // Création d'un état de transcription
        let mut whisper_state = ctx.create_state()
            .map_err(|e| e.to_string())?;

        let beam_size = if duration > 1800.0 { 3 } else { 5 }; // < 30min = 5, sinon = 3

        let mut params = FullParams::new(SamplingStrategy::BeamSearch {
            beam_size,
            patience: 1.0,
        });
        params.set_language(Some("auto")); // Détection automatique langue
        params.set_print_progress(false);  // Désactive logs progression
        params.set_temperature(0.0);       // transcription déterministe
        params.set_translate(translate);   // Active traduction si coché
        params.set_n_threads(threads_per_segment); // Threads CPU utilisés

        whisper_state.full(params, &samples)
            .map_err(|e| e.to_string())?;

        let n = whisper_state.full_n_segments();
        let mut text = String::new();

        // Concatène les segments
        for i in 0..n {
            if let Some(seg) = whisper_state.get_segment(i) {
                if let Ok(t) = seg.to_str() { text.push_str(t); }
            }
        }

        Ok::<String, String>(text.trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())? 
}

/// Chargement d'un modèle Whisper unique
/// 
/// Version utilisée pour la transcription temps réel
/// 
/// # Arguments
/// * `app`   - Handle Tauri
/// * `state` - État global de l'application
/// 
/// # Errors
/// Retourne une erreur si le stockage dans l'état échoue
fn load_whisper_model(
    app: &tauri::AppHandle,
    state: &tauri::State<AppState>,
) -> Result<(), String> {
    // Récupère le modèle sélectionné
    let selected_model = get_selected_model(app.clone())
        .unwrap_or_else(|_| "ggml-small.bin".to_string());

    // Chemin complet du modèle
    let model_path = get_models_dir(app)?
        .join(&selected_model);

    let model_path_str = model_path
        .to_str()
        .ok_or("chemin du modèle invalide")?
        .to_string();

    let mut ctx_lock = state.whisper_ctx.lock()
        .map_err(|e| e.to_string())?;
    let mut model_lock = state.loaded_model.lock()
        .map_err(|e| e.to_string())?;

    let need_reload = match model_lock.as_deref() {
        Some(loaded) => loaded != selected_model,
        None => true,
    };

    if need_reload {
        let ctx = WhisperContext::new_with_params(
            &model_path_str,
            WhisperContextParameters::default(),
        ).map_err(|e| e.to_string())?;

        *ctx_lock = Some(ctx);
        *model_lock = Some(selected_model.clone());
    }

    Ok(())
}

/// Transcrit un petit fichier audio en texte via Whisper
///
/// Extrait d'abord le fichier source avec ffmpeg (conversion en WAV 16kHz mono),
/// puis exécute la transcription Whisper dans un thread bloquant dédié pour ne pas
/// bloquer le runtime Tokio
/// 
/// Le contexte Whisper est acquis uniquement dans `spawn_blocking` pour éviter
/// les contraintes `Send` liées au `MutexGuard`
///
/// # Arguments
/// * `audio_path`     - Chemin vers le fichier audio source complet
/// * `app`            - Handle Tauri
/// * `state`          - État global de l'application
/// * `selected_model` - Modèle Whisper selectionné
/// * `translate`      - Si `true`, traduit le résultat en anglais
///
/// # Returns
/// Le texte transcrit
///
/// # Errors
/// * Si ffmpeg échoue à extraire ou convertir le segment
/// * Si la lecture du fichier WAV temporaire échoue
/// * Si la transcription Whisper échoue
/// * Si le thread `spawn_blocking` panique
async fn transcribe_short(
    audio_path: &str,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    selected_model: String,
    translate: bool,
) -> Result<String, String> {
    // Nombre de threads CPU utilisables
    let threads_per_segment = *state.threads_per_segment.lock()
        .map_err(|e| e.to_string())?;

    // Conversion vers WAV 16kHz
    let converted_path = convert_to_wav_16k(audio_path, &app).await?;
    // Nettoyage automatique du fichier temporaire
    let _guard = TempFiles::new(vec![converted_path.clone()]);

    // Récupération du contexte Whisper 
    let ctx_arc = {
        let pool_lock = state.whisper_pool.lock().map_err(|e| e.to_string())?;
        let pool = pool_lock.as_ref().ok_or("pool non initialisé")?;
        pool.contexts[0].clone()
    }; // pool_lock libéré ici

    let converted_clone = converted_path.clone();

    // Travail CPU-bound Whisper
    let text = tokio::task::spawn_blocking(move || {
        let ctx = ctx_arc.lock().map_err(|e| e.to_string())?;

        let mut reader = hound::WavReader::open(&converted_clone)
            .map_err(|e| e.to_string())?;

        let samples: Vec<f32> = reader
            .samples::<i16>()
            .map(|s| s.map(|v| v as f32 / 32768.0))
            .collect::<Result<Vec<f32>, _>>()
            .map_err(|e| e.to_string())?;

        let mut whisper_state = ctx.create_state()
            .map_err(|e| e.to_string())?;

        let mut params = FullParams::new(SamplingStrategy::BeamSearch {
            beam_size: 5,
            patience: 1.0,
        });
        params.set_language(Some("auto"));
        params.set_print_progress(false);
        params.set_temperature(0.0);
        params.set_translate(translate);
        params.set_n_threads(threads_per_segment);

        whisper_state.full(params, &samples)
            .map_err(|e| e.to_string())?;

        let n = whisper_state.full_n_segments();
        let mut text = String::new();

        for i in 0..n {
            if let Some(seg) = whisper_state.get_segment(i) {
                if let Ok(t) = seg.to_str() { text.push_str(t); }
            }
        }

        Ok::<String, String>(text.trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?;

    // déplie le Result<String, String> interne
    let text = text?;

    // Extraction du nom de fichier
    let filename = std::path::Path::new(audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("inconnu")
        .to_string();

    // Sauvegarde dans l'historique
    let _ = save_transcription(state, filename, text.trim().to_string(), selected_model);

    // Emission du texte final comme un segment unique
    app.emit("transcription_progress", serde_json::json!({
        "percent": 100,
        "segment": 1,
        "total": 1,
        "partial_text": text.trim(),
    })).ok();

    Ok(text.trim().to_string())
}

/// Transcription complète
///
/// Point d'entrée principal
/// 
/// # Arguments
/// * `audio_path` - Chemin vers le fichier audio source complet
/// * `app`        - Handle Tauri
/// * `state`      - État global de l'application
/// * `translate`  - Si `true`, traduit le résultat en anglais
///
/// # Returns
/// Le texte final transcrit
///
/// # Errors
/// * Si la transcription Whisper échoue
#[tauri::command]
pub async fn transcribe_audio(
    audio_path: String,
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    translate: bool,
) -> Result<String, String> {
    // Charge le pool Whisper.
    load_pool(&app, &state)?;

    let threads_per_segment = *state.threads_per_segment.lock()
        .map_err(|e| e.to_string())?;

    let selected_model = get_selected_model(app.clone())
        .unwrap_or_else(|_| "ggml-small.bin".to_string());

    // Durée totale du fichier
    let total_duration = get_duration(&audio_path, &app)
        .await?;

    // Lancement de transcribe_short pour les fichiers de moins de 60 secondes
    if total_duration < 60.0 {
        return transcribe_short(&audio_path, app, state, selected_model, translate)
            .await;
    }

    // Détection des silences
    let splits   = detect_splits(&audio_path, &app).await?;
    // Construction des segments
    let segments = build_segments(splits, total_duration, 30.0);
    let n_total  = segments.len();

    // Emission de la progression initiale
    app.emit("transcription_progress", serde_json::json!({
        "percent": 0,
        "segment": 0,
        "total": n_total,
    })).ok();

    // Récupération des contextes Whisper
    let ctx_arcs = {
        let pool_lock = state.whisper_pool.lock().map_err(|e| e.to_string())?;
        let pool = pool_lock.as_ref().ok_or("pool non initialisé")?;
        pool.contexts.iter().cloned().collect::<Vec<_>>()
    };

    let app_arc        = std::sync::Arc::new(app.clone());
    let audio_path_arc = std::sync::Arc::new(audio_path.clone());

    // Futures parallèles
    let mut futures: futures::stream::FuturesUnordered<SegmentResult> =
        futures::stream::FuturesUnordered::new();

    // Création des tâches async
    for (i, (start, end)) in segments.iter().enumerate() {
        let app_clone  = app_arc.clone();
        let path_clone = audio_path_arc.clone();
        let ctx_arc = ctx_arcs[i % ctx_arcs.len()].clone();
        let start = *start;
        let end = *end;

        // Ajout d'une tâche async au scheduler
        futures.push(tokio::spawn(async move {
            let text = transcribe_segment_async(
                &path_clone,
                start,
                end - start,
                i,
                &app_clone,
                ctx_arc,
                translate,
                threads_per_segment,
            ).await?;

            Ok::<(usize, String), String>((i, text))
        }));
    }

    // Collecte des résultats au fil des complétions
    let mut results = Vec::new();

    while let Some(handle_result) = futures.next().await {
        // Résultat de la tâche Tokio
        let join_result: Result<Result<(usize, String), String>, _> = handle_result;
        let (i, text) = join_result.map_err(|e: tokio::task::JoinError| e.to_string())??;
        // Sauvegarde du résultat
        results.push((i, text.clone()));

        // Nombre de segments déjà terminés
        let completed = results.len();
        // Calcul de la progression
        let percent = (completed as f64 / n_total as f64 * 100.0) as u32;

        // Emission de la progression
        app.emit("transcription_progress", serde_json::json!({
            "percent": percent,
            "segment": i + 1,
            "total": n_total,
            "partial_text": &text,
        })).ok();
    }

    // Réassemblage final
    results.sort_by_key(|(i, _)| *i);

    // Concaténation finale
    let full_text = results
        .iter()
        .filter(|(_, t)| !t.is_empty())
        .map(|(_, t)| t.as_str())
        .collect::<Vec<_>>()
        .join(" ");

    // Extraction du nom de fichier
    let filename = std::path::Path::new(&audio_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("inconnu")
        .to_string();

    // Sauvegarde dans l'historique
    let _ = save_transcription(state, filename, full_text.trim().to_string(), selected_model);

    Ok(full_text.trim().to_string())
}

/// Transcription temps réel
///
/// Transcit le texte en direct depuis un micro
/// 
/// # Arguments
/// * `app`        - Handle Tauri
/// * `state`      - État global de l'application
/// * `audio_data` - Donnèes du micro
/// * `translate`  - Si `true`, traduit le résultat en anglais
///
/// # Returns
/// Le texte final transcrit
///
/// # Errors
/// * Si la transcription Whisper échoue
#[tauri::command]
pub async fn transcribe_chunk(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    audio_data: Vec<u8>,
    translate: bool,
) -> Result<(), String> {
    // Détection du nombre de threads CPU
    let total_threads = std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4);

    let cpu_percent = crate::settings::get_cpu_usage(app.clone())
        .unwrap_or(75) as f64 / 100.0;

    let usable_threads = ((total_threads as f64 * cpu_percent) as usize).max(1) as i32;

    // Sauvegarde le chunk dans un fichier temporaire
    let temp_dir = std::env::temp_dir();

    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();

    let unique_id = ts ^ (&ts as *const _ as u128);

    // Fichier source webm
    let input_path = temp_dir.join(format!("chunk_input_{}.webm", unique_id));
    // Fichier WAV converti
    let output_path = temp_dir.join(format!("chunk_output_{}.wav", unique_id));

    std::fs::write(&input_path, &audio_data)
        .map_err(|e| e.to_string())?;

    // Nettoyage automatique
    let _guard = TempFiles::new(vec![input_path.clone(), output_path.clone()]);

    // Charge le modèle avant tout le travail
    load_whisper_model(&app, &state)?;

    // Convertir en WAV 16kHz avec ffmpeg
    let input_str = input_path.to_str().ok_or("chemin invalide")?;
    let output_str = output_path.to_str().ok_or("chemin invalide")?;

    let audio_filters = audio_filters_realtime();

    let ffmpeg = app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| e.to_string())?
        .args([
            "-i", input_str,
            "-ar", "16000",
            "-ac", "1",
            "-af", &audio_filters,
            "-y",
            output_str,
        ]);

    let output = ffmpeg.output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!(
            "ffmpeg a échoué : {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    // Lecture du fichier WAV
    let mut reader = hound::WavReader::open(&output_path)
        .map_err(|e| e.to_string())?;

    let samples: Vec<f32> = reader
        .samples::<i16>()
        .map(|s| s.map(|sample| sample as f32 / 32768.0))
        .collect::<Result<Vec<f32>, _>>()
        .map_err(|e| e.to_string())?;

    // Transcription
    let text = {
        let ctx_lock = state.whisper_ctx.lock()
            .map_err(|e| e.to_string())?;

        let ctx = ctx_lock.as_ref()
            .ok_or("modèle non chargé")?;

        let mut whisper_state = ctx.create_state()
            .map_err(|e| e.to_string())?;

        // Configuration Greedy
        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_language(Some("auto"));
        params.set_print_progress(false);
        params.set_translate(translate);
        params.set_n_threads(usable_threads);

        // Lance la transcription
        whisper_state.full(params, &samples)
            .map_err(|e| e.to_string())?;

        // Collecter les segments et émettre le texte
        let n = whisper_state.full_n_segments();
        let mut text = String::new();

        for i in 0..n {
            if let Some(segment) = whisper_state.get_segment(i) {
                if let Ok(t) = segment.to_str() {
                    text.push_str(t);
                }
            }
        }

        text
    }; // ctx_lock libéré ici

    // Nettoyage du texte
    let text = text.trim().to_string();

    if !text.is_empty() {
        app.emit("transcription_chunk", &text)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}