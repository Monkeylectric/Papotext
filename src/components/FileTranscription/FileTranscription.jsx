import { FileAudio, Sparkles, Loader2 } from "lucide-react";
import TranscriptionResult from "@components/TranscriptionResult/TranscriptionResult";
import style from "./FileTranscription.module.css";

function FileTranscription({ audioPath, transcription, loading, progress, copied, onSelectFile, onTranscribe, onCopy }) {
    return (
        <div className={style.section}>
            <h2 className={style.sectionTitle}><FileAudio size={16} /> Depuis un fichier</h2>

            <div className={style.fileArea}>
                <button className={style.btnPrimary} onClick={onSelectFile}>
                    Choisir un fichier audio
                </button>

                {audioPath && (
                    <div className={style.fileSelected}>
                        <FileAudio size={15} /> {audioPath.split("\\").pop().split("/").pop()}
                    </div>
                )}

                <button className={style.btnPrimary} onClick={onTranscribe} disabled={!audioPath || loading}>
                    {loading
                        ? <><Loader2 size={15} className="spinning" /> Transcription en cours...</>
                        : <><Sparkles size={16} /> Transcrire</>
                    }
                </button>

                {progress && (
                    <div className={style.progressWrapper}>
                        <div className={style.progressLabel}>
                            <span>Segment {progress.segment} / {progress.total}</span>
                            <span>{progress.percent}%</span>
                        </div>
                        <progress value={progress.percent} max="100" />
                    </div>
                )}
            </div>

            {transcription && (
                <TranscriptionResult
                    title="Résultat"
                    text={transcription}
                    copied={copied}
                    onCopy={onCopy}
                />
            )}
        </div>
    );
}

export default FileTranscription;