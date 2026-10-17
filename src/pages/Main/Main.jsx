import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { AlertCircle } from "lucide-react";
import { translateError } from "@/i18n/errorHelper";
import { createSilenceDetector } from "@utils/silenceDetector";
import TranslateToggle from "@components/TranslateToggle/TranslateToggle";
import FileTranscription from "@components/FileTranscription/FileTranscription";
import LiveTranscription from "@components/LiveTranscription/LiveTranscription";
import LanguageSelect from "@components/LanguageSelect/LanguageSelect";
import style from "./Main.module.css";

const MIN_CHUNK_MS      = 1500; // durée min avant de pouvoir couper
const MAX_CHUNK_MS      = 8000; // durée max avant coupure forcée
const SILENCE_HOLD_MS   = 500;  // silence continu requis pour couper
const SILENCE_THRESHOLD = 0.02; // à ajuster selon micro/environnement

function Main({ isTranscribing, onTranscribingChange, transcriptionProgress, onProgressChange, isCancelling, onCancel, transcriptionError, onErrorChange }) {
    const { t }                             = useTranslation();
    const [audioPath, setAudioPath]         = useState("");
    const [transcription, setTranscription] = useState("");
    const [recording, setRecording]         = useState(false);
    const [liveText, setLiveText]           = useState("");
    const [copiedFile, setCopiedFile]       = useState(false);
    const [copiedLive, setCopiedLive]       = useState(false);
    const [translateMode, setTranslateMode] = useState(false);
    const [language, setLanguage]           = useState("auto");
    const mediaRecorderRef                  = useRef(null);
    const chunkIntervalRef                  = useRef(null);
    const silenceDetectorRef                = useRef(null);
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

                // console.log("segments stockés", {...segmentsRef.current});

                // Reconstruire le texte dans l'ordre des segments reçus jusqu'ici
                const ordered = Object.keys(segmentsRef.current)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map(k => segmentsRef.current[k])
                    .join(" ")
                    .trim();

                // console.log("texte reconstruit", ordered);

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
            filters: [{ name: "Audio", extensions: ["wav", "mp3", "ogg", "flac", "m4a"] }],
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
            const result = await invoke("transcribe_audio", { audioPath, translate: translateMode, language });
            // setTranscription(result);
        } catch (e) {
            setError(translateError(String(e)));
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
            silenceDetectorRef.current = createSilenceDetector(stream);

            const recordChunk = () => {
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;

                const chunkStart = Date.now();
                let silenceStart = null;
                let hadSpeech = false;

                chunkIntervalRef.current = setInterval(() => {
                    const volume = silenceDetectorRef.current.getVolume();
                    const elapsed = Date.now() - chunkStart;

                    if (volume >= SILENCE_THRESHOLD) {
                        hadSpeech = true;
                        silenceStart = null;
                    } else if (silenceStart === null) {
                        silenceStart = Date.now();
                    }

                    const silenceElapsed = silenceStart ? Date.now() - silenceStart : 0;
                    const shouldStopOnSilence = elapsed >= MIN_CHUNK_MS && silenceElapsed >= SILENCE_HOLD_MS;
                    const shouldStopOnMax = elapsed >= MAX_CHUNK_MS;

                    if ((shouldStopOnSilence || shouldStopOnMax) && mediaRecorder.state === "recording") {
                        clearInterval(chunkIntervalRef.current);
                        mediaRecorder.stop();
                    }
                }, 100);

                mediaRecorder.ondataavailable = async (e) => {
                    if (e.data.size === 0 || !hadSpeech) {
                        // Silence pur : on ne transcrit pas, on repart directement
                        if (mediaRecorderRef.current !== null) recordChunk();
                        return;
                    }

                    const arrayBuffer = await e.data.arrayBuffer();
                    const audioData = Array.from(new Uint8Array(arrayBuffer));

                    try {
                        const [_, tokens] = await invoke("transcribe_chunk", {
                            audioData,
                            translate: translateMode,
                            promptTokens: promptTokensRef.current,
                            language,
                        });

                        promptTokensRef.current = tokens;
                    } catch (err) {
                        setError(t("live.micError", { message: e.message }));
                    }

                    if (mediaRecorderRef.current !== null) recordChunk();
                };

                mediaRecorder.start();
            };

            recordChunk();
            setRecording(true);
        } catch (e) {
            setError(t("live.micError") + e.message);
        }
    }
    
    async function stopRecording() {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
            mediaRecorderRef.current = null;
        }

        if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);

        promptTokensRef.current = [];
        setRecording(false);

        // Sauvegarde de la session live dans l'historique (une seule entrée pour toute la session)
        const finalText = liveText.trim();

        if (finalText.length > 0) {
            try {
                const model = await invoke("get_selected_model");
                const filename = `Live - ${new Date().toLocaleString()}`;

                await invoke("save_transcription", {
                    filename,
                    audioPath: "",   // pas de fichier audio persisté pour une session live
                    text: finalText,
                    model,
                    segments: null,
                });
            } catch (e) {
                console.error("Impossible de sauvegarder la session live :", e);
            }
        }
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
                <h1 className={style.pageTitle}>{t("main.title")}</h1>

                <LanguageSelect value={language} onChange={setLanguage} />
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
                isCancelling={isCancelling}
                onCancel={onCancel}
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