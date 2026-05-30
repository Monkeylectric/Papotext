import { useTranslation } from "react-i18next";
import style from "./TranslateToggle.module.css";

function TranslateToggle({ value, onChange }) {
    const { t } = useTranslation();

    return (
        <div className={style.translateToggle}>
            <label className={style.toggleLabel}>
                <div
                    className={`${style.toggle} ${value ? style.toggleActive : ""}`}
                    onClick={() => onChange(v => !v)}
                >
                    <div className={style.toggleThumb} />
                </div>
                <span>{t("main.translateToggle")}</span>
            </label>
        </div>
    );
}

export default TranslateToggle;