import { Copy, Check } from "lucide-react";
import style from "./TranscriptionResult.module.css";

function TranscriptionResult({ title, text, copied, onCopy }) {
    return (
        <div className={style.result}>
            <div className={style.resultHeader}>
                <h3>{title}</h3>
                <button className={style.btnCopy} onClick={() => onCopy(text)}>
                    {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                </button>
            </div>
            <div className={style.resultText}>{text}</div>
        </div>
    );
}

export default TranscriptionResult;