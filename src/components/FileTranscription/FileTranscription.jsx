import { useTranslation } from "react-i18next";
import { FileAudio, Sparkles, Loader2, X } from "lucide-react";
import TranscriptionResult from "@components/TranscriptionResult/TranscriptionResult";
import style from "./FileTranscription.module.css";

function FileTranscription({ audioPath, transcription, loading, progress, copied, onSelectFile, onTranscribe, isCancelling, onCancel, onCopy }) {
    const { t } = useTranslation();

    return (
        <div className={style.section}>
            <h2 className={style.sectionTitle}><FileAudio size={16} /> {t("main.fromFile")}</h2>

            <div className={style.fileArea}>
                <button className={style.btnPrimary} onClick={onSelectFile}>
                    {t("main.chooseFile")}
                </button>

                {audioPath && (
                    <div className={style.fileSelected}>
                        <FileAudio size={15} /> {audioPath.split("\\").pop().split("/").pop()}
                    </div>
                )}

                <button className={style.btnPrimary} onClick={onTranscribe} disabled={!audioPath || loading}>
                    {loading
                        ? <><Loader2 size={15} className="spinning" /> {t("main.transcribing")}</>
                        : <><Sparkles size={16} /> {t("main.transcribe")}</>
                    }
                </button>

                {loading && (
                    <button className={style.btnCancel} onClick={onCancel} disabled={isCancelling}>
                        {isCancelling
                            ? <><Loader2 size={15} className="spinning" /> {t("main.cancelling")}</>
                            : <><X size={15} /> {t("main.cancel")}</>
                        }
                    </button>
                )}

                {progress && (
                    <div className={style.progressWrapper}>
                        <div className={style.progressLabel}>
                            <span>{t("main.segment", { current: progress.segment, total: progress.total})}</span>
                            <span>{progress.percent}%</span>
                        </div>
                        <progress value={progress.percent} max="100" />
                    </div>
                )}
            </div>

            {transcription && (
                <TranscriptionResult
                    title={t("main.result")}
                    text={transcription}
                    copied={copied}
                    onCopy={onCopy}
                />
            )}
        </div>
    );
}

export default FileTranscription;