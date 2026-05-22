import { Mic, Square } from "lucide-react";
import TranscriptionResult from "@components/TranscriptionResult/TranscriptionResult";
import style from "./LiveTranscription.module.css";

function LiveTranscription({ recording, liveText, copied, onStart, onStop, onCopy }) {
    return (
        <div className={style.section}>
            <h2 className={style.sectionTitle}><Mic size={16} /> En direct</h2>

            <div className={style.fileArea}>
                {!recording ? (
                    <button className={style.btnRecord} onClick={onStart}>
                        <Mic size={16} /> Démarrer l'enregistrement
                    </button>
                ) : (
                    <>
                        <button className={style.btnStop} onClick={onStop}>
                            <Square size={16} /> Arrêter
                        </button>
                        <div className={style.recordingBadge}>
                            <span className={style.recordingDot} />
                            Enregistrement en cours...
                        </div>
                    </>
                )}
            </div>

            {liveText && (
                <TranscriptionResult
                    title="Transcription en direct"
                    text={liveText}
                    copied={copied}
                    onCopy={onCopy}
                />
            )}
        </div>
    );
}

export default LiveTranscription;