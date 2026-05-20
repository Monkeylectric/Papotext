import { FileAudio, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import style from "./TranscriptionCard.module.css";

function TranscriptionCard({ transcription: t, isActive, onToggle, onDelete }) {
    return (
        <div
            className={`${style.card} ${isActive ? style.cardActive : ""}`}
            onClick={() => onToggle(t)}
        >
            <div className={style.cardHeader}>
                <span className={style.cardFilename}><FileAudio size={15} /> {t.filename}</span>
                <div className={style.cardRight}>
                    <span className={style.cardMeta}>{t.created_at} · {t.model}</span>
                    <button
                        className={style.btnDelete}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(t.id);
                        }}
                    >
                        <Trash2 size={15} />
                    </button>
                    <span className={style.chevron}>
                        {isActive ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </span>
                </div>
            </div>
            {!isActive && (
                <p className={style.cardPreview}>{t.text}</p>
            )}
        </div>
    );
}

export default TranscriptionCard;