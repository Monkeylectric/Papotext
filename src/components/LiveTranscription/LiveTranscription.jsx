import { useTranslation } from "react-i18next";
import { Mic, Square } from "lucide-react";
import TranscriptionResult from "@components/TranscriptionResult/TranscriptionResult";
import style from "./LiveTranscription.module.css";

function LiveTranscription({ recording, liveText, copied, onStart, onStop, onCopy }) {
    const { t } = useTranslation();

    return (
        <div className={style.section}>
            <h2 className={style.sectionTitle}><Mic size={16} /> {t("live.title")}</h2>

            <div className={style.fileArea}>
                {!recording ? (
                    <button className={style.btnRecord} onClick={onStart}>
                        <Mic size={16} /> {t("live.start")}
                    </button>
                ) : (
                    <>
                        <button className={style.btnStop} onClick={onStop}>
                            <Square size={16} /> {t("live.stop")}
                        </button>
                        <div className={style.recordingBadge}>
                            <span className={style.recordingDot} />
                            {t("live.recording")}
                        </div>
                    </>
                )}
            </div>

            {liveText && (
                <TranscriptionResult
                    title={t("live.result")}
                    text={liveText}
                    copied={copied}
                    onCopy={onCopy}
                />
            )}
        </div>
    );
}

export default LiveTranscription;