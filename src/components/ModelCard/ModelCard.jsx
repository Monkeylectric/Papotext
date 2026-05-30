import { useTranslation } from "react-i18next";
import { Download, Trash2, Check, Loader2 } from "lucide-react";
import style from "./ModelCard.module.css";

function ModelCard({ model, isActive, isInstalled, isDownloading, progress, onUse, onDelete, onDownload }) {
    const { t } = useTranslation();

    return (
        <div className={`${style.modelCard} ${isActive ? style.modelCardActive : ""}`}>
            <div className={style.modelCardHeader}>
                <div className={style.modelCardTitle}>
                    <span className={style.modelCardLabel}>{model.label}</span>
                    <span className={style.modelCardSize}>{model.size}</span>
                </div>
                {isActive && (
                    <span className={style.badgeActive}>
                        <Check size={13} /> {t("settings.activeModelCard")}
                    </span>
                )}
            </div>

            <p className={style.modelCardDesc}>{model.desc}</p>

            <div className={style.modelCardActions}>
                {!isActive && isInstalled && (
                    <>
                        <button className={style.btnUse} onClick={onUse}>
                            {t("actions.use")}
                        </button>
                        {model.name !== "ggml-small.bin" && (
                            <button className={style.btnDelete} onClick={onDelete}>
                                <Trash2 size={14} />
                            </button>
                        )}
                    </>
                )}
                {!isInstalled && !isDownloading && (
                    <button className={style.btnDownload} onClick={onDownload}>
                        <Download size={14} /> {t("actions.download")}
                    </button>
                )}
                {isDownloading && (
                    <span className={style.downloadingLabel}>
                        <Loader2 size={14} className="spinning" /> {progress}%
                    </span>
                )}
            </div>
        </div>
    );
}

export default ModelCard;