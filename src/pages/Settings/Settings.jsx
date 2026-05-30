import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Check, AlertCircle } from "lucide-react";
import i18n from "@/i18n/index.js";
import ConfirmModal from "@components/ConfirmModal/ConfirmModal";
import ModelCard from "@components/ModelCard/ModelCard";
import LocalModelSection from "@components/LocalModelSection/LocalModelSection";
import CpuSlider from "@components/CpuSlider/CpuSlider";
import style from "./Settings.module.css";

function Settings() {
    const { t }                                 = useTranslation();
    const [selectedModel, setSelectedModel]     = useState("");
    const [availableModels, setAvailableModels] = useState([]);
    const [downloading, setDownloading]         = useState(null);
    const [progress, setProgress]               = useState(0);
    const [error, setError]                     = useState("");
    const [confirmModel, setConfirmModel]       = useState(null);
    const [cpuUsage, setCpuUsage]               = useState(75);

    const MODELS = [
        { name: "ggml-tiny.bin",   label: "Tiny",   size: "75 Mo",   desc: t("models.tiny.desc") },
        { name: "ggml-base.bin",   label: "Base",   size: "142 Mo",  desc: t("models.base.desc") },
        { name: "ggml-small.bin",  label: "Small",  size: "466 Mo",  desc: t("models.small.desc") },
        { name: "ggml-medium.bin", label: "Medium", size: "1.5 Go",  desc: t("models.medium.desc") },
        { name: "ggml-large.bin",  label: "Large",  size: "2.9 Go",  desc: t("models.large.desc") },
    ]
    
    useEffect(() => {
        loadData();

        const unlistenProgress = listen("download_progress", (e) => setProgress(e.payload));
        const unlistenComplete = listen("download_complete", () => {
            setDownloading(null);
            setProgress(0);
            loadData();
        });

        return () => {
            unlistenProgress.then(f => f());
            unlistenComplete.then(f => f());
        };
    }, []);
    
    async function loadData() {
        const [model, models, cpu] = await Promise.all([
            invoke("get_selected_model"),
            invoke("get_available_models"),
            invoke("get_cpu_usage"),
        ]);

        setSelectedModel(model);
        setAvailableModels(models);
        setCpuUsage(cpu);
    }

    async function updateCpuUsage(value) {
        setCpuUsage(value);
        await invoke("set_cpu_usage", { value });
    }
    
    async function selectModel(modelName) {
        await invoke("set_selected_model", { modelName });
        setSelectedModel(modelName);
    }
    
    async function downloadModel(modelName) {
        setDownloading(modelName);
        setProgress(0);
        setError("");

        try {
            await invoke("download_model", { modelName });
        } catch (e) {
            setError(String(e));
            setDownloading(null);
        }
    }
    
    async function deleteModel(modelName) {
        try {
            await invoke("delete_model", { modelName });

            if (selectedModel === modelName) {
                await invoke("set_selected_model", { modelName: "ggml-small.bin" });
                setSelectedModel("ggml-small.bin");
            }

            setConfirmModel(null);
            loadData();
        } catch (e) {
            setError(String(e));
        }
    }
    
    async function selectLocalFile() {
        const selected = await open({
            filters: [{ name: "Modèle Whisper", extensions: ["bin"] }],
        });

        if (selected) {
            const filename = selected.split("\\").pop().split("/").pop();
            await invoke("set_selected_model", { modelName: filename });

            setSelectedModel(filename);
        }
    }
    
    return (
        <div className={style.page}>
            {/* Modale de confirmation */}
            {confirmModel && (
                <ConfirmModal
                    title={t("settings.deleteConfirmTitle")}
                    message={t("settings.deleteConfirmMsg", { model: confirmModel })}
                    onConfirm={() => deleteModel(confirmModel)}
                    onCancel={() => setConfirmModel(null)}
                />
            )}

            <h1 className={style.pageTitle}>{t("settings.title")}</h1>
        
            {/* Modèles */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>{t("settings.modelSection")}</h2>
                <p className={style.sectionDesc}>{t("settings.modelDesc")}</p>
        
                <div className={style.activeModel}>
                    <Check size={14} /> {t("settings.activeModel", { activeModel: selectedModel })}
                </div>

                {/* Grille */}
                <div className={style.modelGrid}>
                    {MODELS.map((model) => {
                        return (
                            <ModelCard 
                                key={model.name} 
                                model={model} 
                                isActive={selectedModel === model.name} 
                                isInstalled={availableModels.includes(model.name)} 
                                isDownloading={downloading === model.name} 
                                progress={progress} 
                                onUse={() => selectModel(model.name)} 
                                onDelete={() => setConfirmModel(model.name)} 
                                onDownload={() => downloadModel(model.name)}
                            />
                        );
                    })}
                </div>
        
                {downloading && (
                <div className={style.downloadProgress}>
                    <div className={style.downloadLabel}>
                        <span>{t("settings.downloading", { model: downloading })}</span>
                        <span className={style.downloadPercent}>{progress}%</span>
                    </div>
                    <progress value={progress} max="100" />
                </div>
                )}
        
                {error && <div className={style.error}><AlertCircle size={15} /> {error}</div>}
            </div>
        
            {/* Modèle local */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>{t("settings.localSection")}</h2>
                <LocalModelSection onSelectFile={selectLocalFile} />
            </div>

            {/* Performances */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>{t("settings.perfSection")}</h2>
                <p className={style.sectionDesc}>{t("settings.perfDesc")}</p>

                <CpuSlider value={cpuUsage} onChange={updateCpuUsage} />
            </div>

            {/* Language */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>{t("settings.language")}</h2>
                <div style={{ display: "flex", gap: "8px" }}>
                    {["fr", "en"].map(lang => (
                    <button
                        key={lang}
                        onClick={() => i18n.changeLanguage(lang)}
                        style={{ fontWeight: i18n.language === lang ? "bold" : "normal" }}
                    >
                        {lang === "fr" ? "🇫🇷 Français" : "🇬🇧 English"}
                    </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Settings;