import i18n from "./index.js";

export function translateError(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed.key) return i18n.t(parsed.key, parsed); // interpolation avec detail/segment
    } catch { /* pas du JSON */ }

    // clé directe
    const translated = i18n.t(raw);
    if (translated !== raw) return translated;

    // Fallback : message brut (erreurs libs externes)
    return raw;
}