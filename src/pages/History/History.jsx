import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileAudio, Trash2, Copy, Check, ChevronDown, ChevronUp, Inbox, Loader2 } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import historyStyles from "./History.module.css";

function History() {
    const s = historyStyles;
    const [transcriptions, setTranscriptions] = useState([]);
    const [selected, setSelected]             = useState(null);
    const [loading, setLoading]               = useState(true);
    const [copied, setCopied]                 = useState(false);
    const [confirmId, setConfirmId]           = useState(null);
    
    useEffect(() => {
        loadHistory();
    }, []);
    
    async function loadHistory() {
        setLoading(true);

        try {
            const result = await invoke("get_transcriptions");

            setTranscriptions(result);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }
    
    async function deleteTranscription(id) {
        try {
            await invoke("delete_transcription", { id });

            if (selected?.id === id) setSelected(null);

            setConfirmId(null);
            loadHistory();
        } catch (e) {
            console.error(e);
        }
    }
    
    function copyText(text) {
        navigator.clipboard.writeText(text);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }
    
    if (loading) {
        return <div className={s.loading}><Loader2 size={15} className="spinning" /> Chargement...</div>;
    }
    
    if (transcriptions.length === 0) {
        return (
            <div className={s.page}>
                <h1 className={s.pageTitle}>Historique</h1>
                <div className={s.empty}>
                    <div className={s.emptyIcon}><Inbox size={48} /></div>
                    <p className={s.emptyText}>Aucune transcription</p>
                    <p className={s.emptyDesc}>Les transcriptions apparaîtront ici.</p>
                </div>
            </div>
        );
    }

    function toggleSelected(t) {
        setSelected(prev => prev?.id === t.id ? null : t);
    }
    
    return (
        <div className={s.page}>
            {/* Modale de confirmation */}
            {confirmId !== null && (
                <ConfirmModal
                    title="Supprimer cette transcription ?"
                    message={`Cette transcription sera supprimée définitivement. Cette action est irréversible.`}
                    onConfirm={() => deleteTranscription(confirmId)}
                    onCancel={() => setConfirmId(null)}
                />
            )}

            <h1 className={s.pageTitle}>Historique</h1>
        
            <div className={s.list}>
                {transcriptions.map((t) => (
                    <div key={t.id}>
                        {/* Carte */}
                        <div
                            className={`${s.card} ${selected?.id === t.id ? s.cardActive : ""}`}
                            onClick={() => toggleSelected(t)}
                        >
                            <div className={s.cardHeader}>
                                <span className={s.cardFilename}><FileAudio size={15} /> {t.filename}</span>
                                <div className={s.cardRight}>
                                    <span className={s.cardMeta}>{t.created_at} · {t.model}</span>
                                    <button
                                        className={s.btnDelete}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setConfirmId(t.id);
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                    <span className={s.chevron}>
                                        {selected?.id === t.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                    </span>
                                </div>
                            </div>
                            {selected?.id !== t.id && (
                                <p className={s.cardPreview}>{t.text}</p>
                            )}
                        </div>

                        {/* Accordion — s'ouvre sous la carte */}
                        {selected?.id === t.id && (
                            <div className={s.accordion}>
                                <div className={s.accordionText}>{t.text}</div>
                                <div className={s.accordionActions}>
                                    <button className={s.btnCopy} onClick={() => copyText(t.text)}>
                                        {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier le texte</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

export default History;