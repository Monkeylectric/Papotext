import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Check, AlertCircle } from "lucide-react";
import ConfirmModal from "@components/ConfirmModal/ConfirmModal";
import ModelCard from "@components/ModelCard/ModelCard";
import LocalModelSection from "@components/LocalModelSection/LocalModelSection";
import CpuSlider from "@components/CpuSlider/CpuSlider";
import style from "./Settings.module.css";

const MODELS = [
    { name: "ggml-tiny.bin",   label: "Tiny",   size: "75 Mo",   desc: "Rapide, configs limitées" },
    { name: "ggml-base.bin",   label: "Base",   size: "142 Mo",  desc: "Bon compromis vitesse/qualité" },
    { name: "ggml-small.bin",  label: "Small",  size: "466 Mo",  desc: "Recommandé" },
    { name: "ggml-medium.bin", label: "Medium", size: "1.5 Go",  desc: "Bonne qualité" },
    { name: "ggml-large.bin",  label: "Large",  size: "2.9 Go",  desc: "Meilleure qualité" },
]

function Settings() {
    const [selectedModel, setSelectedModel]     = useState("");
    const [availableModels, setAvailableModels] = useState([]);
    const [downloading, setDownloading]         = useState(null);
    const [progress, setProgress]               = useState(0);
    const [error, setError]                     = useState("");
    const [confirmModel, setConfirmModel]       = useState(null);
    const [cpuUsage, setCpuUsage]               = useState(75);
    
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
                    title="Supprimer ce modèle ?"
                    message={`${confirmModel} sera supprimé définitivement. Vous devrez le retélécharger pour l'utiliser à nouveau.`}
                    onConfirm={() => deleteModel(confirmModel)}
                    onCancel={() => setConfirmModel(null)}
                />
            )}

            <h1 className={style.pageTitle}>Paramètres</h1>
        
            {/* Modèles */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>Modèle de transcription</h2>
                <p className={style.sectionDesc}>Le modèle détermine la qualité et la vitesse de transcription.</p>
        
                <div className={style.activeModel}>
                    <Check size={14} /> Modèle actif : {selectedModel}
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
                        <span>Téléchargement de {downloading}...</span>
                        <span className={style.downloadPercent}>{progress}%</span>
                    </div>
                    <progress value={progress} max="100" />
                </div>
                )}
        
                {error && <div className={style.error}><AlertCircle size={15} /> {error}</div>}
            </div>
        
            {/* Modèle local */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>Modèle local</h2>
                <LocalModelSection onSelectFile={selectLocalFile} />
            </div>

            {/* Performances */}
            <div className={style.section}>
                <h2 className={style.sectionTitle}>Performances</h2>
                <p className={style.sectionDesc}>
                    Ajustez l'utilisation du CPU pendant la transcription.
                    Une valeur plus basse laisse la machine plus réactive.
                </p>

                <CpuSlider value={cpuUsage} onChange={updateCpuUsage} />
            </div>
        </div>
    );
}

export default Settings;