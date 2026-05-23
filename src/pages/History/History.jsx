import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Inbox, Loader2, Save } from "lucide-react";
import ConfirmModal from "@components/ConfirmModal/ConfirmModal";
import HistoryStats from "@components/HistoryStats/HistoryStats";
import TranscriptionCard from "@components/TranscriptionCard/TranscriptionCard";
import TranscriptionAccordion from "@components/TranscriptionAccordion/TranscriptionAccordion";
import Pagination from "@components/Pagination/Pagination";
import style from "./History.module.css";

function History() {
    const [transcriptions, setTranscriptions] = useState([]);
    const [selected, setSelected]             = useState(null);
    const [loading, setLoading]               = useState(true);
    const [copied, setCopied]                 = useState(false);
    const [confirmId, setConfirmId]           = useState(null);
    const [page, setPage]                     = useState(1);
    const [total, setTotal]                   = useState(0);
    const [pageSize, setPageSize]             = useState(20);
    const [editingId, setEditingId]           = useState(null);
    const [editText, setEditText]             = useState("");
    const [saving, setSaving]                 = useState(false);
    const [audioSrc, setAudioSrc]             = useState(null);
    const [activeSegIdx, setActiveSegIdx]     = useState(-1);
    const [loadingAudio, setLoadingAudio]     = useState(false);
    const [exportOpenId, setExportOpenId]     = useState(null);
    const textareaRef                         = useRef(null);
    const audioRef                            = useRef(null);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    
    useEffect(() => {
        loadHistory(page);
    }, [page]);

    // Focus automatique et curseur en fin de texte à l'ouverture de l'éditeur
    useEffect(() => {
        if (editingId !== null && textareaRef.current) {
            const el = textareaRef.current;

            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [editingId]);

    async function loadAudio(t, e) {
        e.stopPropagation();

        // Si déjà ouvert, on ferme
        if (audioSrc?.id === t.id) {
            setAudioSrc(null);
            setActiveSegIdx(-1);

            return;
        }

        if (!t.audio_path) return;

        setLoadingAudio(true);
        
        try {
            const base64 = await invoke("get_audio_base64", { path: t.audio_path });
            const segments = t.segments ? JSON.parse(t.segments) : [];
            
            setAudioSrc({ id: t.id, src: base64, segments });
            setActiveSegIdx(-1);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingAudio(false);
        }
    }

    function handleTimeUpdate() {
        if (!audioRef.current || !audioSrc?.segments?.length) return;

        // Whisper timestamps en centisecondes, audio en secondes
        const cs = audioRef.current.currentTime * 100;
        const idx = audioSrc.segments.findIndex(s => cs >= s.t0 && cs <= s.t1);

        setActiveSegIdx(idx);
    }
    
    async function loadHistory(p) {
        setLoading(true);

        try {
            const result = await invoke("get_transcriptions", { page: p });

            setTranscriptions(result.items);
            setTotal(result.total);
            setPageSize(result.page_size);
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

            // Si on supprime le dernier élément de la page courante,
            // on revient à la page précédente (sauf si on est déjà à la 1ère)
            const itemsAfterDelete = transcriptions.length - 1;
            const targetPage = itemsAfterDelete === 0 && page > 1 ? page - 1 : page;

            if (targetPage !== page) {
                setPage(targetPage);
            } else {
                loadHistory(page);
            }
        } catch (e) {
            console.error(e);
        }
    }

    function startEdit(t, e) {
        e.stopPropagation();

        setEditingId(t.id);
        setEditText(t.text);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditText("");
    }

    async function saveEdit(id) {
        if (saving) return;

        setSaving(true);

        try {
            await invoke("update_transcription", { id, text: editText });

            // Mise à jour locale sans rechargement réseau
            setTranscriptions(prev => prev.map(t =>
                t.id === id ? { ...t, text: editText } : t
            ));

            // Synchroniser l'élément sélectionné si c'est lui
            setSelected(prev => prev?.id === id ? { ...prev, text: editText } : prev);
            cancelEdit();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }
    
    function copyText(text) {
        navigator.clipboard.writeText(text);

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function toggleSelected(t) {
        setSelected(prev => prev?.id === t.id ? null : t);
    }

    function goToPage(p) {
        if (p < 1 || p > totalPages) return;
        setSelected(null);
        setPage(p);
    }
    
    if (loading) {
        return <div className={style.loading}><Loader2 size={15} className="spinning" /> Chargement...</div>;
    }
    
    if (total === 0) {
        return (
            <div className={style.page}>
                <h1 className={style.pageTitle}>Historique</h1>
                <div className={style.empty}>
                    <div className={style.emptyIcon}><Inbox size={48} /></div>
                    <p className={style.emptyText}>Aucune transcription</p>
                    <p className={style.emptyDesc}>Les transcriptions apparaîtront ici.</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className={style.page}>
            {/* Modale de confirmation */}
            {confirmId !== null && (
                <ConfirmModal
                    title="Supprimer cette transcription ?"
                    message={`Cette transcription sera supprimée définitivement. Cette action est irréversible.`}
                    onConfirm={() => deleteTranscription(confirmId)}
                    onCancel={() => setConfirmId(null)}
                />
            )}

            <div className={style.pageHeader}>
                <h1 className={style.pageTitle}>Historique</h1>
                <HistoryStats />
            </div>
        
            <div className={style.list}>
                {transcriptions.map((t) => (
                    <div key={t.id}>
                        {/* Carte */}
                        <TranscriptionCard 
                            transcription={t} 
                            isActive={selected?.id === t.id} 
                            onToggle={toggleSelected} 
                            onDelete={setConfirmId}
                        />

                        {/* Accordion — s'ouvre sous la carte */}
                        {selected?.id === t.id && (
                            <TranscriptionAccordion
                                transcription={t}
                                audioSrc={audioSrc}
                                audioRef={audioRef}
                                activeSegIdx={activeSegIdx}
                                loadingAudio={loadingAudio}
                                onLoadAudio={loadAudio}
                                onTimeUpdate={handleTimeUpdate}
                                onAudioEnded={() => setActiveSegIdx(-1)}
                                editingId={editingId}
                                editText={editText}
                                saving={saving}
                                onEditTextChange={setEditText}
                                onStartEdit={startEdit}
                                onCancelEdit={cancelEdit}
                                onSaveEdit={saveEdit}
                                copied={copied}
                                onCopy={copyText}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination 
                    page={page} 
                    totalPages={totalPages} 
                    onPageChange={goToPage} 
                />
            )}
        </div>
    );
}

export default History;