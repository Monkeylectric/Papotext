// Erreur simple - clé i18n
pub fn err(key: &str) -> String {
    key.to_string()
}

// Erreur avec détail dynamique : JSON parseable par le frontend
pub fn err_detail(key: &str, detail: &str) -> String {
    serde_json::json!({ "key": key, "detail": detail }).to_string()
}

// Erreur avec segment + détail (pour les segments audio)
pub fn err_segment(key: &str, segment: usize, detail: &str) -> String {
    serde_json::json!({ "key": key, "segment": segment, "detail": detail }).to_string()
}