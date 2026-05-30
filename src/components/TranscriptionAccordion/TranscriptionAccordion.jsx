import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import AudioPlayer from "@components/AudioPlayer/AudioPlayer";
import SegmentedText from "@components/SegmentedText/SegmentedText";
import AccordionActions from "@components/AccordionActions/AccordionActions";
import style from "./TranscriptionAccordion.module.css";

function TranscriptionAccordion({
    transcription,
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
    const { t }       = useTranslation();
    const textareaRef = useRef(null);
    const isEditing   = editingId === transcription.id;
    const isAudioOpen = audioSrc?.id === transcription.id;
    const segments    = isAudioOpen ? audioSrc.segments : null;

    // Focus automatique + curseur en fin de texte
    useEffect(() => {
        if (isEditing && textareaRef.current) {
            const el = textareaRef.current;

            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [isEditing]);

    // Curseur à l'endroit du segment en cours
    useEffect(() => {
        if (!isEditing || !isAudioOpen || !textareaRef.current) return;
        if (activeSegIdx < 0 || !segments?.[activeSegIdx]) return;

        const segText = segments[activeSegIdx].text.trim();
        const pos = editText.indexOf(segText);

        if (pos !== -1) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(pos, pos + segText.length);

            // Scroll du textarea pour rendre la sélection visible
            const lineHeight = parseInt(getComputedStyle(textareaRef.current).lineHeight);
            const lines = editText.substring(0, pos).split("\n").length;
            textareaRef.current.scrollTop = (lines - 2) * lineHeight;
        }
    }, [activeSegIdx]);

    return (
        <div className={style.accordion}>
            {/* Lecteur audio — toujours visible si chargé */}
            {isAudioOpen && (
                <AudioPlayer
                    src={audioSrc.src}
                    segments={audioSrc.segments}
                    activeSegIdx={activeSegIdx}
                    audioRef={audioRef}
                    onTimeUpdate={onTimeUpdate}
                    onEnded={onAudioEnded}
                />
            )}

            {/* Surbrillance en mode édition si audio actif */}
            {!isEditing && (
                <SegmentedText
                    text={transcription.text}
                    segments={segments}
                    activeSegIdx={activeSegIdx}
                />
            )}

            {/* Textarea en mode lecture avec surbrillance */}
            {isEditing && (
                <>
                    <textarea
                        ref={textareaRef}
                        className={style.editTextarea}
                        value={editText}
                        onChange={e => onEditTextChange(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === "Escape") onCancelEdit();
                            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onSaveEdit(transcription.id);
                        }}
                    />
                    <p className={style.editHint}>{t("edit.hint")}</p>
                </>
            )}

            <AccordionActions
                transcription={transcription}
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