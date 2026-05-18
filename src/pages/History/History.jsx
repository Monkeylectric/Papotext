import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FileAudio, Trash2, Copy, Check, ChevronDown, ChevronUp, Inbox, Loader2, ChevronRight, ChevronLeft, Pencil, X, Save } from "lucide-react";
import ConfirmModal from "../../components/ConfirmModal/ConfirmModal";
import historyStyles from "./History.module.css";

function History() {
    const s = historyStyles;
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
    const textareaRef                         = useRef(null);

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

    /// Génère la liste des numéros de pages à afficher
    function buildPageNumbers(current, total) {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        const pages = [];
        const addPage = (p) => { 
            if (!pages.includes(p)) pages.push(p);
        };

        addPage(1);
        if (current > 3) pages.push("…");
        for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) addPage(p);
        if (current < total - 2) pages.push("…");
        addPage(total);

        return pages;
    }
    
    if (loading) {
        return <div className={s.loading}><Loader2 size={15} className="spinning" /> Chargement...</div>;
    }
    
    if (total === 0) {
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

            <div className={s.pageHeader}>
                <h1 className={s.pageTitle}>Historique</h1>
                <span className={s.totalCount}>{total} transcription{total > 1 ? "s" : ""}</span>
            </div>
        
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
                                {editingId === t.id ? (
                                    // Mode édition 
                                    <>
                                        <textarea
                                            ref={textareaRef}
                                            className={s.editTextarea}
                                            value={editText}
                                            onChange={e => setEditText(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === "Escape") cancelEdit();
                                                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit(t.id);
                                            }}
                                        />
                                        <p className={s.editHint}>Ctrl+Entrée pour sauvegarder · Échap pour annuler</p>
                                        <div className={s.accordionActions}>
                                            <button className={s.btnCancel} onClick={cancelEdit}>
                                                <X size={14} /> Annuler
                                            </button>
                                            <button className={s.btnSave} onClick={() => saveEdit(t.id)} disabled={saving}>
                                                {saving
                                                    ? <><Loader2 size={14} className="spinning" /> Enregistrement...</>
                                                    : <><Save size={14} /> Enregistrer</>
                                                }
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    // Mode lecture
                                    <>
                                        <div className={s.accordionText}>{t.text}</div>
                                        <div className={s.accordionActions}>
                                            <button className={s.btnEdit} onClick={(e) => startEdit(t, e)}>
                                                <Pencil size={14} /> Modifier
                                            </button>
                                            <button className={s.btnCopy} onClick={() => copyText(t.text)}>
                                                {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={s.pagination}>
                    <button
                        className={s.pageBtn}
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1}
                        aria-label="Page précédente"
                    >
                        <ChevronLeft size={16} />
                    </button>

                    {buildPageNumbers(page, totalPages).map((p, i) =>
                        p === "…" ? (
                            <span key={`ellipsis-${i}`} className={s.pageEllipsis}>…</span>
                        ) : (
                            <button
                                key={p}
                                className={`${s.pageBtn} ${p === page ? s.pageBtnActive : ""}`}
                                onClick={() => goToPage(p)}
                            >
                                {p}
                            </button>
                        )
                    )}

                    <button
                        className={s.pageBtn}
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages}
                        aria-label="Page suivante"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default History;