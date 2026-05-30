import { useTranslation } from "react-i18next";
import { Copy, Check } from "lucide-react";
import style from "./TranscriptionResult.module.css";

function TranscriptionResult({ title, text, copied, onCopy }) {
    const { t } = useTranslation();

    return (
        <div className={style.result}>
            <div className={style.resultHeader}>
                <h3>{title}</h3>
                <button className={style.btnCopy} onClick={() => onCopy(text)}>
                    {copied ? <><Check size={14} /> {t("actions.copied")}</> : <><Copy size={14} /> {t("actions.copy")}</>}
                </button>
            </div>
            <div className={style.resultText}>{text}</div>
        </div>
    );
}

export default TranscriptionResult;