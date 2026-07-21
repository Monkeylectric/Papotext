import { useTranslation } from "react-i18next";
import style from "./LanguageSelect.module.css";

// Codes de langue supportés par Whisper. Le nom est affiché dans sa langue
// native (indépendamment de la langue de l'interface), sauf "auto" qui est traduit.
const LANGUAGES = [
    { code: "auto", nativeName: null },
    { code: "fr",   nativeName: "Français" },
    { code: "en",   nativeName: "English" },
    { code: "es",   nativeName: "Español" },
    { code: "de",   nativeName: "Deutsch" },
    { code: "it",   nativeName: "Italiano" },
    { code: "pt",   nativeName: "Português" },
    { code: "nl",   nativeName: "Nederlands" },
    { code: "ru",   nativeName: "Русский" },
    { code: "ar",   nativeName: "العربية" },
    { code: "zh",   nativeName: "中文" },
    { code: "ja",   nativeName: "日本語" },
    { code: "ko",   nativeName: "한국어" },
];

function LanguageSelect({ value, onChange }) {
    const { t } = useTranslation();

    return (
        <div className={style.languageSelect}>
            <label className={style.selectLabel}>
                <span>{t("main.languageSelect")}</span>

                <select
                    className={style.select}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                >
                    {LANGUAGES.map(({ code, nativeName }) => (
                        <option key={code} value={code}>
                            {code === "auto" ? t("main.languageAuto") : nativeName}
                        </option>
                    ))}
                </select>
            </label>
        </div>
    );
}

export default LanguageSelect;