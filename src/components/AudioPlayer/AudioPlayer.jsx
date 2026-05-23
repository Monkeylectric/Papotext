import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import style from "./AudioPlayer.module.css";

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
        return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    return `${m}:${String(s).padStart(2, "0")}`;
}

function AudioPlayer({ src, segments, activeSegIdx, onTimeUpdate, onEnded, audioRef }) {
    const progressRef             = useRef(null);
    const [playing, setPlaying]   = useState(false);
    const [muted, setMuted]       = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const activeSeg = segments?.[activeSegIdx] ?? null;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onLoaded = () => setDuration(audio.duration || 0);
        const onTime = () => {
            setCurrentTime(audio.currentTime);
            onTimeUpdate?.();
        };
        const onEnd = () => { s
            etPlaying(false); onEnded?.();
        };

        audio.addEventListener("play", onPlay);
        audio.addEventListener("pause", onPause);
        audio.addEventListener("loadedmetadata", onLoaded);
        audio.addEventListener("timeupdate", onTime);
        audio.addEventListener("ended", onEnd);

        return () => {
            audio.removeEventListener("play", onPlay);
            audio.removeEventListener("pause", onPause);
            audio.removeEventListener("loadedmetadata", onLoaded);
            audio.removeEventListener("timeupdate", onTime);
            audio.removeEventListener("ended", onEnd);
        };
    }, [audioRef.current]);

    function togglePlay() {
        const audio = audioRef.current;
        if (!audio) return;

        playing ? audio.pause() : audio.play();
    }

    function toggleMute() {
        const audio = audioRef.current;
        if (!audio) return;

        audio.muted = !audio.muted;

        setMuted(!muted);
    }

    function seek(e) {
        const audio = audioRef.current;
        if (!audio || !progressRef.current) return;

        const rect  = progressRef.current.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;

        audio.currentTime = ratio * duration;
    }

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className={style.player}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Contrôles */}
            <div className={style.controls}>
                <button className={style.btnPlay} onClick={togglePlay} onMouseDown={e => e.preventDefault()}>
                    {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>

                <span className={style.time}>{formatTime(currentTime)}</span>

                {/* Barre de progression */}
                <div className={style.progressBar} ref={progressRef} onClick={seek} onMouseDown={e => e.preventDefault()}>
                    <div className={style.progressFill} style={{ width: `${progress}%` }}>
                        <div className={style.progressThumb} />
                    </div>

                    {/* Marqueurs de segments */}
                    {segments?.map((seg, idx) => {
                        if (!duration) return null;
                        const pos = ((seg.t0 / 100) / duration) * 100;
                        return (
                            <div
                                key={idx}
                                className={`${style.segmentMarker} ${idx === activeSegIdx ? style.segmentMarkerActive : ""}`}
                                style={{ left: `${pos}%` }}
                            />
                        );
                    })}
                </div>

                <span className={style.time}>{formatTime(duration)}</span>

                <button className={style.btnMute} onClick={toggleMute} onMouseDown={e => e.preventDefault()}>
                    {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                </button>
            </div>

            {/* Indicateur de segment actif */}
            <div className={`${style.segmentIndicator} ${activeSeg ? style.segmentIndicatorVisible : ""}`}>
                {activeSeg
                    ? <span className={style.segmentText}>"{activeSeg.text}"</span>
                    : <span className={style.segmentPlaceholder}>—</span>
                }
            </div>
        </div>
    );
}

export default AudioPlayer;