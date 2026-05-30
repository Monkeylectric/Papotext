import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Inbox, Loader2, Save, Search, X } from "lucide-react";
import ConfirmModal from "@components/ConfirmModal/ConfirmModal";
import HistoryStats from "@components/HistoryStats/HistoryStats";
import TranscriptionCard from "@components/TranscriptionCard/TranscriptionCard";
import TranscriptionAccordion from "@components/TranscriptionAccordion/TranscriptionAccordion";
import Pagination from "@components/Pagination/Pagination";
import style from "./History.module.css";

function History() {
    const { t }                               = useTranslation();
    const [transcriptions, setTranscriptions] = useState([]);
    const [selected, setSelected]             = useState(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [listLoading, setListLoading]       = useState(false);
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
    const [searchQuery, setSearchQuery]       = useState("");
    const textareaRef                         = useRef(null);
    const audioRef                            = useRef(null);
    const audioCacheRef                       = useRef(new Map());
    const saveTimerRef                        = useRef(null);
    const prevSearchQuery                     = useRef("");

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    
    useEffect(() => {
        loadHistory(page, searchQuery);
    }, [page]);

    // Focus automatique et curseur en fin de texte à l'ouverture de l'éditeur
    useEffect(() => {
        if (editingId !== null && textareaRef.current) {
            const el = textareaRef.current;

            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        }
    }, [editingId]);

    // Recharge l'historique à la modification du champs de recherche
    useEffect(() => {
        if (searchQuery === prevSearchQuery.current) return;
        prevSearchQuery.current = searchQuery;

        const timer = setTimeout(() => {
            setPage(1);
            loadHistory(1, searchQuery);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    async function loadAudio(t, e) {
        e.stopPropagation();

        if (audioSrc?.id === t.id) {
            setAudioSrc(null);
            setActiveSegIdx(-1);

            return;
        }

        if (!t.audio_path) return;

        // Vérification du cache
        if (audioCacheRef.current.has(t.id)) {
            const cached = audioCacheRef.current.get(t.id);

            setAudioSrc({ id: t.id, ...cached });
            setActiveSegIdx(-1);

            return;
        }

        setLoadingAudio(true);

        try {
            const base64   = await invoke("get_audio_base64", { path: t.audio_path });
            const segments = t.segments ? JSON.parse(t.segments) : [];

            // Mise en cache
            audioCacheRef.current.set(t.id, { src: base64, segments });
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
    
    async function loadHistory(p, q = searchQuery) {
        if (initialLoading) {
            setInitialLoading(true);
        } else {
            setListLoading(true);
        }

        try {
            const result = await invoke("get_transcriptions", {
                page: p,
                query: q || null,
            });

            setTranscriptions(result.items);
            setTotal(result.total);
            setPageSize(result.page_size);
        } catch (e) {
            console.error(e);
        } finally {
            setInitialLoading(false);
            setListLoading(false);
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
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        setEditingId(null);
        setEditText("");
    }

    async function saveEdit(id, textOverride) {
        if (saving) return;

        const textToSave = textOverride ?? editText;
        setSaving(true);

        try {
            await invoke("update_transcription", { id, text: textToSave });
            setTranscriptions(prev => prev.map(t => t.id === id ? { ...t, text: textToSave } : t));
            setSelected(prev => prev?.id === id ? { ...prev, text: textToSave } : prev);

            // Ne pas appeler cancelEdit() en mode auto-save
            if (textOverride === undefined) cancelEdit();
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
        cancelEdit();
        setAudioSrc(null);
        audioCacheRef.current.clear();
        setPage(p);
    }

    function handleEditTextChange(text, id) {
        setEditText(text);

        // Reset du timer précédent
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        // Nouvelle sauvegarde dans 5 seconde
        saveTimerRef.current = setTimeout(() => {
            saveEdit(id, text);
        }, 5000);
    }
    
    if (initialLoading) {
        return <div className={style.loading}><Loader2 size={15} className="spinning" /> {t("history.loading")}</div>;
    }
    
    if (total === 0) {
        return (
            <div className={style.page}>
                <h1 className={style.pageTitle}>{t("history.title")}</h1>
                <div className={style.empty}>
                    <div className={style.emptyIcon}><Inbox size={48} /></div>
                    <p className={style.emptyText}>{t("history.empty")}</p>
                    <p className={style.emptyDesc}>{t("history.emptyDesc")}</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className={style.page}>
            {/* Modale de confirmation */}
            {confirmId !== null && (
                <ConfirmModal
                    title={t("history.deleteConfirmTitle")}
                    message={t("history.deleteConfirmMsg")}
                    onConfirm={() => deleteTranscription(confirmId)}
                    onCancel={() => setConfirmId(null)}
                />
            )}

            <div className={style.pageHeader}>
                <h1 className={style.pageTitle}>{t("history.title")}</h1>
                <HistoryStats />
            </div>

            <div className={style.searchWrapper}>
                <Search size={15} />
                <input
                    type="text"
                    className={style.searchInput}
                    placeholder={t("history.search")}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button className={style.searchClear} onClick={() => setSearchQuery("")}>
                        <X size={14} />
                    </button>
                )}
            </div>
        
            <div className={`${style.list} ${listLoading ? style.listLoading : ""}`}>
                {transcriptions.map((transcription) => (
                    <div key={transcription.id}>
                        {/* Carte */}
                        <TranscriptionCard 
                            transcription={transcription} 
                            isActive={selected?.id === transcription.id} 
                            onToggle={toggleSelected} 
                            onDelete={setConfirmId}
                        />

                        {/* Accordion — s'ouvre sous la carte */}
                        {selected?.id === transcription.id && (
                            <TranscriptionAccordion
                                transcription={transcription}
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
                                onEditTextChange={(text) => handleEditTextChange(text, editingId)}
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