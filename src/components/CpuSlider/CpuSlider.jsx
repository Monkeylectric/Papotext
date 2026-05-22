import style from "./CpuSlider.module.css";

const HINTS = {
    25:  "🐢 Lent - machine très réactive",
    50:  "⚖️ Équilibré - bon compromis",
    75:  "⚡ Rapide - recommandé",
    100: "🚀 Maximum - transcription la plus rapide",
};

function CpuSlider({ value, onChange }) {
    return (
        <>
            <div className={style.sliderRow}>
                <span className={style.sliderLabel}>Utilisation CPU</span>
                <div className={style.sliderWrapper}>
                    <input
                        type="range"
                        min="25"
                        max="100"
                        step="25"
                        value={value}
                        onChange={e => onChange(Number(e.target.value))}
                        className={style.slider}
                    />
                    <div className={style.sliderTicks}>
                        {[25, 50, 75, 100].map(v => (
                            <span
                                key={v}
                                className={`${style.sliderTick} ${value === v ? style.sliderTickActive : ""}`}
                            >
                                {v}%
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <p className={style.sliderHint}>{HINTS[value]}</p>
        </>
    );
}

export default CpuSlider;