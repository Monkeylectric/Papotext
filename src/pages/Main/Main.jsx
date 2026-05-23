import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle } from "lucide-react";
import TranslateToggle from "@components/TranslateToggle/TranslateToggle";
import FileTranscription from "@components/FileTranscription/FileTranscription";
import LiveTranscription from "@components/LiveTranscription/LiveTranscription";
import style from "./Main.module.css";

function Main({ isTranscribing, onTranscribingChange, transcriptionProgress, onProgressChange, transcriptionError, onErrorChange }) {
    const [audioPath, setAudioPath]         = useState("");
    const [transcription, setTranscription] = useState("");
    const [recording, setRecording]         = useState(false);
    const [liveText, setLiveText]           = useState("");
    const [copiedFile, setCopiedFile]       = useState(false);
    const [copiedLive, setCopiedLive]       = useState(false);
    const [translateMode, setTranslateMode] = useState(false);
    const mediaRecorderRef                  = useRef(null);
    const chunkIntervalRef                  = useRef(null);
    const transcriptionRef                  = useRef("");
    const segmentsRef                       = useRef({});
    const receivedCountRef                  = useRef(0);
    const promptTokensRef                   = useRef([]);

    const loading     = isTranscribing;
    const setLoading  = onTranscribingChange;
    const progress    = transcriptionProgress;
    const setProgress = onProgressChange;
    const error       = transcriptionError;
    const setError    = onErrorChange;
    
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
        if (!audioPath || isTranscribing) return;

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
        promptTokensRef.current = [];

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
                        // Passer les tokens du chunk précédent
                        const [_, tokens] = await invoke("transcribe_chunk", {
                            audioData,
                            translate: translateMode,
                            promptTokens: promptTokensRef.current,
                        });

                        // Stocker les tokens pour le prochain chunk
                        promptTokensRef.current = tokens;
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

        promptTokensRef.current = [];
        setRecording(false);
    }
    
    function copyFileText(text) {
        navigator.clipboard.writeText(text);

        setCopiedFile(true);
        setTimeout(() => setCopiedFile(false), 2000);
    }

    function copyLiveText(text) {
        navigator.clipboard.writeText(text);

        setCopiedLive(true);
        setTimeout(() => setCopiedLive(false), 2000);
    }
    
    return (
        <div className={style.page}>
            <div className={style.pageHeader}>
                <h1 className={style.pageTitle}>Transcription Audio</h1>

                <TranslateToggle value={translateMode} onChange={setTranslateMode} />
            </div>
        
            {/* Section fichier */}
            <FileTranscription
                audioPath={audioPath}
                transcription={transcription}
                loading={loading}
                progress={progress}
                copied={copiedFile}
                onSelectFile={selectFile}
                onTranscribe={transcribe}
                onCopy={copyFileText}
            />
        
            {/* Section enregistrement */}
            <LiveTranscription
                recording={recording}
                liveText={liveText}
                copied={copiedLive}
                onStart={startRecording}
                onStop={stopRecording}
                onCopy={copyLiveText}
            />
        
            {error && <div className={style.error}><AlertCircle size={15} /> {error}</div>}
        </div>
    );
}

export default Main;