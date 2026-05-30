import { FileAudio, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import style from "./TranscriptionCard.module.css";

function TranscriptionCard({ transcription, isActive, onToggle, onDelete }) {
    return (
        <div
            className={`${style.card} ${isActive ? style.cardActive : ""}`}
            onClick={() => onToggle(transcription)}
        >
            <div className={style.cardHeader}>
                <span className={style.cardFilename}><FileAudio size={15} /> {transcription.filename}</span>
                <div className={style.cardRight}>
                    <span className={style.cardMeta}>{transcription.created_at} · {transcription.model}</span>
                    <button
                        className={style.btnDelete}
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(transcription.id);
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
                <p className={style.cardPreview}>{transcription.text}</p>
            )}
        </div>
    );
}

export default TranscriptionCard;