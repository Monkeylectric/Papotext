import { useTranslation } from "react-i18next";
import { Copy, Check, Pencil, X, Save, Volume2, VolumeX, Loader2 } from "lucide-react";
import ExportDropdown from "@components/ExportDropdown/ExportDropdown";
import style from "./AccordionActions.module.css";

function AccordionActions({
    transcription,
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
    const { t } = useTranslation();

    const audioButton = transcription.audio_path && (
        <button className={style.btnAudio} onClick={(e) => onLoadAudio(transcription, e)} disabled={loadingAudio}>
            {loadingAudio
                ? <><Loader2 size={14} className="spinning" /> {t("actions.loadingAudio")}</>
                : isAudioOpen
                    ? <><VolumeX size={14} /> {t("actions.closeAudio")}</>
                    : <><Volume2 size={14} /> {t("actions.listen")}</>
            }
        </button>
    );

    if (isEditing) {
        return (
            <div className={style.actions}>
                {audioButton}
                <button className={style.btnCancel} onClick={onCancelEdit}>
                    <X size={14} /> {t("actions.quit")}
                </button>
                <button className={style.btnSave} onClick={() => onSaveEdit(transcription.id)} disabled={saving}>
                    {saving
                        ? <><Loader2 size={14} className="spinning" /> {t("actions.saving")}</>
                        : <><Save size={14} /> {t("actions.save")}</>
                    }
                </button>
            </div>
        );
    }

    return (
        <div className={style.actions}>
            {audioButton}
            <button className={style.btnEdit} onClick={(e) => onStartEdit(transcription, e)}>
                <Pencil size={14} /> {t("actions.edit")}
            </button>
            <button className={style.btnCopy} onClick={() => onCopy(transcription.text)}>
                {copied ? <><Check size={14} /> {t("actions.copied")}</> : <><Copy size={14} /> {t("actions.copy")}</>}
            </button>
            <ExportDropdown text={transcription.text} segments={transcription.segments} filename={transcription.filename} />
        </div>
    );
}

export default AccordionActions;