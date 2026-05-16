import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { FileAudio, Mic, Square, Copy, Check, Sparkles, Loader2 } from "lucide-react";
import mainStyles from "./Main.module.css";

function Main() {
    const s = mainStyles;
    const [audioPath, setAudioPath]         = useState("");
    const [transcription, setTranscription] = useState("");
    const [loading, setLoading]             = useState(false);
    const [error, setError]                 = useState("");
    const [recording, setRecording]         = useState(false);
    const [liveText, setLiveText]           = useState("");
    const [copied, setCopied]               = useState(false);
    const [progress, setProgress]           = useState(null);
    const [translateMode, setTranslateMode] = useState(false);
    const mediaRecorderRef                  = useRef(null);
    const chunkIntervalRef                  = useRef(null);
    const transcriptionRef                  = useRef("");
    const segmentsRef                       = useRef({});
    const receivedCountRef                  = useRef(0);
    
    useEffect(() => {
        const unlisten = listen("transcription_chunk", (event) => {
            setLiveText(prev => prev + " " + event.payload);
        });

        const unlistenProgress = listen("transcription_progress", (e) => {
            // console.log("transcription_progress reçu", e.payload);
            setProgress(e.payload);

            // Afficher le texte partiel au fur et à mesure
            if (e.payload.partial_text && e.payload.segment > 0) {
                receivedCountRef.current += 1;

                // Stocker chaque segment par son index
                segmentsRef.current[e.payload.segment] = e.payload.partial_text;

                console.log("segments stockés", {...segmentsRef.current});

                // Reconstruire le texte dans l'ordre des segments reçus jusqu'ici
                const ordered = Object.keys(segmentsRef.current)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map(k => segmentsRef.current[k])
                    .join(" ")
                    .trim();

                console.log("texte reconstruit", ordered);

                setTranscription(ordered);

                // Afficher le compteur dans l'ordre, pas l'index Rust
                setProgress({
                    ...e.payload,
                    segment: receivedCountRef.current, // 1, 2, 3, 4...
                });
            }
        });

        return () => { 
            unlisten.then(f => f());
            unlistenProgress.then(f => f());
        };
    }, []);
    
    async function selectFile() {
        const selected = await open({
            multiple: false,
            filters: [{ name: "Audio", extensions: ["wav", "mp3"] }],
        });

        if (selected) {
            setAudioPath(selected);
            setTranscription("");
            setError("");
        }
    }
    
    async function transcribe() {
        if (!audioPath) return;

        setLoading(true);
        setError("");
        setTranscription("");
        transcriptionRef.current = "";
        segmentsRef.current = {};
        receivedCountRef.current  = 0;
        setProgress(null);
        
        try {
            const result = await invoke("transcribe_audio", { audioPath, translate: translateMode });
            // setTranscription(result);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
            setProgress(null);
        }
    }
    
    async function startRecording() {
        setLiveText("");
        setError("");
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
            const recordChunk = () => {
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
        
                mediaRecorder.ondataavailable = async (e) => {
                    if (e.data.size === 0) return;

                    const arrayBuffer = await e.data.arrayBuffer();
                    const audioData = Array.from(new Uint8Array(arrayBuffer));

                    try {
                        await invoke("transcribe_chunk", { audioData, translate: translateMode });
                    } catch (err) {
                        setError(String(err));
                    }

                    if (mediaRecorderRef.current !== null) recordChunk();
                };
        
                mediaRecorder.start();

                setTimeout(() => {
                    if (mediaRecorder.state === "recording") mediaRecorder.stop();
                }, 3000);
            };
        
            recordChunk();
            setRecording(true);
        } catch (e) {
            setError("Impossible d'accéder au microphone : " + e.message);
        }
    }
    
    function stopRecording() {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }

        if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
        
        setRecording(false);
    }
    
    function copyText(text) {
        navigator.clipboard.writeText(text);
        
        setCopied(true);
        
        setTimeout(() => setCopied(false), 2000);
    }
    
    return (
        <div className={s.page}>
            <div className={s.pageHeader}>
                <h1 className={s.pageTitle}>Transcription Audio</h1>

                <div className={s.translateToggle}>
                    <label className={s.toggleLabel}>
                        <div
                            className={`${s.toggle} ${translateMode ? s.toggleActive : ""}`}
                            onClick={() => setTranslateMode(t => !t)}
                        >
                            <div className={s.toggleThumb} />
                        </div>
                        <span>Traduire en anglais</span>
                    </label>
                </div>
            </div>
        
            {/* Section fichier */}
            <div className={s.section}>
                <h2 className={s.sectionTitle}><FileAudio size={16} /> Depuis un fichier</h2>
                <div className={s.fileArea}>
                    <button className={s.btnPrimary} onClick={selectFile}>
                        Choisir un fichier audio
                    </button>
                    {audioPath && (
                        <div className={s.fileSelected}>
                            <FileAudio size={15} /> {audioPath.split("\\").pop().split("/").pop()}
                        </div>
                    )}
                    <button
                        className={s.btnPrimary}
                        onClick={transcribe}
                        disabled={!audioPath || loading}
                    >
                        {loading ? <><Loader2 size={15} className="spinning" /> Transcription en cours...</> : <><Sparkles size={16} /> Transcrire</>}
                    </button>
                    {progress && (
                        <div className={s.progressWrapper}>
                            <div className={s.progressLabel}>
                                <span>Segment {progress.segment} / {progress.total}</span>
                                <span>{progress.percent}%</span>
                            </div>
                            <progress value={progress.percent} max="100" />
                        </div>
                    )}
                </div>
        
                {transcription && (
                    <div className={s.result}>
                        <div className={s.resultHeader}>
                            <h3>Résultat</h3>
                            <button className={s.btnCopy} onClick={() => copyText(transcription)}>
                                {copied ? <><Check size={14} /> Copié !</> : <><Copy size={14} /> Copier</>}
                            </button>
                        </div>
                        <div className={s.resultText}>{transcription}</div>
                    </div>
                )}
            </div>
        
            {/* Section enregistrement */}
            <div className={s.section}>
                <h2 className={s.sectionTitle}><Mic size={16} /> En direct</h2>
                <div className={s.fileArea}>
                {!recording ? (
                    <button className={s.btnRecord} onClick={startRecording}>
                        <Mic size={16} /> Démarrer l'enregistrement
                    </button>
                ) : (
                    <>
                        <button className={s.btnStop} onClick={stopRecording}>
                            <Square size={16} /> Arrêter
                        </button>
                        <div className={s.recordingBadge}>
                            <span className={s.recordingDot} />
                            Enregistrement en cours...
                        </div>
                    </>
                )}
                </div>
        
                {liveText && (
                <div className={s.result}>
                    <div className={s.resultHeader}>
                        <h3>Transcription en direct</h3>
                        <button className={s.btnCopy} onClick={() => copyText(liveText)}>
                            {copied ? "✅ Copié !" : "📋 Copier"}
                        </button>
                    </div>
                    <div className={s.resultText}>{liveText}</div>
                </div>
                )}
            </div>
        
            {error && <div className={s.error}>❌ {error}</div>}
        </div>
    );
}

export default Main;