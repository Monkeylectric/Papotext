import { useRef, useEffect } from "react";
import SegmentedText from "../SegmentedText/SegmentedText";
import AccordionActions from "../AccordionActions/AccordionActions";
import style from "./TranscriptionAccordion.module.css";

function TranscriptionAccordion({
    transcription: t,
    // Audio
    audioSrc,
    audioRef,
    activeSegIdx,
    loadingAudio,
    onLoadAudio,
    onTimeUpdate,
    onAudioEnded,
    // Edition
    editingId,
    editText,
    saving,
    onEditTextChange,
    onStartEdit,
    onCancelEdit,
    onSaveEdit,
    // Copie
    copied,
    onCopy,
}) {
    const textareaRef = useRef(null);
    const isEditing   = editingId === t.id;
    const isAudioOpen = audioSrc?.id === t.id;
    const segments    = isAudioOpen ? audioSrc.segments : null;

    // Focus automatique + curseur en fin de texte
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const el = textareaRef.current;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [isEditing]);

    return (
        <div className={style.accordion}>
            {/* Lecteur audio — toujours visible si chargé */}
            {isAudioOpen && (
                <audio
                    ref={audioRef}
                    src={audioSrc.src}
                    controls
                    className={style.audioPlayer}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={onAudioEnded}
                />
            )}

            {/* Surbrillance en mode édition si audio actif */}
            {isEditing && isAudioOpen && segments?.length > 0 && (
                <SegmentedText
                    text={t.text}
                    segments={segments}
                    activeSegIdx={activeSegIdx}
                    readonly
                />
            )}

            {/* Textarea en mode édition */}
            {isEditing && (
                <>
                    <textarea
                        ref={textareaRef}
                        className={style.editTextarea}
                        value={editText}
                        onChange={e => onEditTextChange(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Escape") onCancelEdit();
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSaveEdit(t.id);
                        }}
                    />
                    <p className={style.editHint}>Ctrl+Entrée pour sauvegarder · Échap pour annuler</p>
                </>
            )}

            {/* Texte en mode lecture */}
            {!isEditing && (
                <SegmentedText
                    text={t.text}
                    segments={segments}
                    activeSegIdx={activeSegIdx}
                />
            )}

            <AccordionActions
                transcription={t}
                isEditing={isEditing}
                isAudioOpen={isAudioOpen}
                loadingAudio={loadingAudio}
                copied={copied}
                saving={saving}
                onLoadAudio={onLoadAudio}
                onStartEdit={onStartEdit}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onCopy={onCopy}
            />
        </div>
    );
}

export default TranscriptionAccordion;