import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { FileAudio, Cpu, Hash } from "lucide-react";
import style from "./HistoryStats.module.css";

function HistoryStats() {
    const { t }             = useTranslation();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        invoke("get_history_stats").then(setStats).catch(console.error);
    }, []);

    if (!stats || stats.total === 0) return null;

    return (
        <div className={style.stats}>
            <div className={style.stat}>
                <Hash size={14} />
                <div className={style.statContent}>
                    <span className={style.statLabel}>{t("history.stats.total")}</span>
                    <span className={style.statValue}>{stats.total}</span>
                </div>
            </div>
            {stats.top_model && (
                <div className={style.stat}>
                    <Cpu size={14} />
                    <div className={style.statContent}>
                        <span className={style.statLabel}>{t("history.stats.topModel")}</span>
                        <span className={style.statValue}>{stats.top_model}</span>
                    </div>
                </div>
            )}
            {stats.latest_filename && (
                <div className={style.stat}>
                    <FileAudio size={14} />
                    <div className={style.statContent}>
                        <span className={style.statLabel}>{t("history.stats.latestFile")}</span>
                        <span className={style.statValue}>{stats.latest_filename}</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default HistoryStats;