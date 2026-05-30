import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ChevronDown, FileText, Subtitles, Download } from "lucide-react";
import style from "./ExportDropdown.module.css";

function ExportDropdown({ text, segments, filename }) {
    const { t }           = useTranslation();
    const [open, setOpen] = useState(false);
    
    return (
        <div className={style.exportDropdown}>
            <button className={style.exportBtn} onClick={() => setOpen(prev => !prev)}>
                <Download size={14} /> {t("actions.export")} <ChevronDown size={12} />
            </button>
            {open && (
                <div className={style.exportMenu}>
                    <button className={style.exportMenuItem}
                        onClick={() => {
                            invoke("export_as_txt", { text, filename });
                            setOpen(null);
                        }}
                    >
                        <FileText size={14} /> .txt
                    </button>
                    {segments && (
                        <button className={style.exportMenuItem}
                            onClick={() => {
                                invoke("export_as_srt", { segments, filename });
                                setOpen(null);
                            }}
                        >
                            <Subtitles size={14} /> .srt
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default ExportDropdown;