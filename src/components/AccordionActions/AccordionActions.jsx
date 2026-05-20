import { Copy, Check, Pencil, X, Save, Volume2, VolumeX, Loader2 } from "lucide-react";
import ExportDropdown from "@components/ExportDropdown/ExportDropdown";
import style from "./AccordionActions.module.css";

function AccordionActions({
    transcription: t,
    isEditing,
    isAudioOpen,
    loadingAudio,
    copied,
    saving,
    onLoadAudio,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    onCopy,
}) {
    const audioButton = t.audio_path && (
        <button className={style.btnAudio} onClick={(e) => onLoadAudio(t, e)} disabled={loadingAudio}>
            {loadingAudio
                ? <><Loader2 size={14} className="spinning" /> Chargement...</>
                : isAudioOpen
                    ? <><VolumeX size={14} /> Fermer l'audio</>
                    : <><Volume2 size={14} /> Écouter</>
            }
        </button>
    );

    if (isEditing) {
        return (
            <div className={style.actions}>
                {audioButton}
                <button className={style.btnCancel} onClick={onCancelEdit}>
                    <X size={14} /> Annuler
                </button>
                <button className={style.btnSave} onClick={() => onSaveEdit(t.id)} disabled={saving}>
                    {saving
                        ? <><Loader2 size={14} className="spinning" /> Enregistrement...</>
                        : <><Save size={14} /> Enregistrer</>
                    }
                </button>
            </div>
        );
    }

    return (
        <div className={style.actions}>
            {audioButton}
            <button className={style.btnEdit} onClick={(e) => onStartEdit(t, e)}>
                <Pencil size={14} /> Modifier
            </button>
            <button className={style.btnCopy} onClick={() => onCopy(t.text)}>
                {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
            </button>
            <ExportDropdown text={t.text} segments={t.segments} filename={t.filename} />
        </div>
    );
}

export default AccordionActions;