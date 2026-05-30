import { useTranslation } from "react-i18next";
import style from "./CpuSlider.module.css";

function CpuSlider({ value, onChange }) {
    const { t } = useTranslation();

    const HINTS = {
        25:  t("cpu.slow"),
        50:  t("cpu.balanced"),
        75:  t("cpu.fast"),
        100: t("cpu.max"),
    };

    return (
        <>
            <div className={style.sliderRow}>
                <span className={style.sliderLabel}>{t("cpu.label")}</span>
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