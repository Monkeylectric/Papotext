import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { Download, Trash2, Check, FolderOpen, AlertCircle, Loader2 } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import settingsStyles from "./Settings.module.css";

const MODELS = [
    { name: "ggml-tiny.bin",   label: "Tiny",   size: "75 Mo",   desc: "Rapide, configs limitées" },
    { name: "ggml-base.bin",   label: "Base",   size: "142 Mo",  desc: "Bon compromis vitesse/qualité" },
    { name: "ggml-small.bin",  label: "Small",  size: "466 Mo",  desc: "Recommandé" },
    { name: "ggml-medium.bin", label: "Medium", size: "1.5 Go",  desc: "Bonne qualité" },
    { name: "ggml-large.bin",  label: "Large",  size: "2.9 Go",  desc: "Meilleure qualité" },
]

function Settings() {
    const s = settingsStyles;
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
        <div className={s.page}>
            {/* Modale de confirmation */}
            {confirmModel && (
                <ConfirmModal
                    title="Supprimer ce modèle ?"
                    message={`${confirmModel} sera supprimé définitivement. Vous devrez le retélécharger pour l'utiliser à nouveau.`}
                    onConfirm={() => deleteModel(confirmModel)}
                    onCancel={() => setConfirmModel(null)}
                />
            )}

            <h1 className={s.pageTitle}>Paramètres</h1>
        
            {/* Modèles */}
            <div className={s.section}>
                <h2 className={s.sectionTitle}>Modèle de transcription</h2>
                <p className={s.sectionDesc}>Le modèle détermine la qualité et la vitesse de transcription.</p>
        
                <div className={s.activeModel}>
                    <Check size={14} /> Modèle actif : {selectedModel}
                </div>

                {/* Grille */}
                <div className={s.modelGrid}>
                    {MODELS.map((model) => {
                        const isInstalled   = availableModels.includes(model.name);
                        const isActive      = selectedModel === model.name;
                        const isDownloading = downloading === model.name;

                        return (
                            <div
                                key={model.name}
                                className={`${s.modelCard} ${isActive ? s.modelCardActive : ""}`}
                            >
                                <div className={s.modelCardHeader}>
                                    <div className={s.modelCardTitle}>
                                        <span className={s.modelCardLabel}>{model.label}</span>
                                        <span className={s.modelCardSize}>{model.size}</span>
                                    </div>
                                    {isActive && (
                                        <span className={s.badgeActive}>
                                            <Check size={13} /> Actif
                                        </span>
                                    )}
                                </div>

                                <p className={s.modelCardDesc}>{model.desc}</p>

                                <div className={s.modelCardActions}>
                                    {!isActive && isInstalled && (
                                        <>
                                            <button className={s.btnUse} onClick={() => selectModel(model.name)}>
                                                Utiliser
                                            </button>
                                            {model.name !== "ggml-small.bin" && (
                                                <button className={s.btnDelete} onClick={() => setConfirmModel(model.name)}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </>
                                    )}
                                    {!isInstalled && !isDownloading && (
                                        <button className={s.btnDownload} onClick={() => downloadModel(model.name)}>
                                            <Download size={14} /> Télécharger
                                        </button>
                                    )}
                                    {isDownloading && (
                                        <span className={s.downloadingLabel}>
                                            <Loader2 size={14} className="spinning" /> {progress}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
        
                {downloading && (
                <div className={s.downloadProgress}>
                    <div className={s.downloadLabel}>
                        <span>Téléchargement de {downloading}...</span>
                        <span className={s.downloadPercent}>{progress}%</span>
                    </div>
                    <progress value={progress} max="100" />
                </div>
                )}
        
                {error && <div className={s.error}><AlertCircle size={15} /> {error}</div>}
            </div>
        
            {/* Modèle local */}
            <div className={s.section}>
                <h2 className={s.sectionTitle}>Modèle local</h2>
                <p className={s.localModelDesc}>
                    Tu peux télécharger manuellement un modèle depuis <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank">HuggingFace</a> et le sélectionner ici.
                </p>
                <button className={s.btnLocal} onClick={selectLocalFile}>
                    <FolderOpen size={16} /> Sélectionner un fichier .bin local
                </button>
            </div>

            {/* Performances */}
            <div className={s.section}>
                <h2 className={s.sectionTitle}>Performances</h2>
                <p className={s.sectionDesc}>
                    Ajustez l'utilisation du CPU pendant la transcription.
                    Une valeur plus basse laisse la machine plus réactive.
                </p>

                <div className={s.sliderRow}>
                    <span className={s.sliderLabel}>Utilisation CPU</span>
                    <div className={s.sliderWrapper}>
                        <input
                            type="range"
                            min="25"
                            max="100"
                            step="25"
                            value={cpuUsage}
                            onChange={e => updateCpuUsage(Number(e.target.value))}
                            className={s.slider}
                        />
                        <div className={s.sliderTicks}>
                            {[25, 50, 75, 100].map(v => (
                                <span
                                    key={v}
                                    className={`${s.sliderTick} ${cpuUsage === v ? s.sliderTickActive : ""}`}
                                >
                                    {v}%
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <p className={s.sliderHint}>
                    {cpuUsage === 25  && "🐢 Lent — machine très réactive"}
                    {cpuUsage === 50  && "⚖️ Équilibré — bon compromis"}
                    {cpuUsage === 75  && "⚡ Rapide — recommandé"}
                    {cpuUsage === 100 && "🚀 Maximum — transcription la plus rapide"}
                </p>
            </div>
        </div>
    );
}

export default Settings;