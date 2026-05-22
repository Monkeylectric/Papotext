import style from "./TranslateToggle.module.css";

function TranslateToggle({ value, onChange }) {
    return (
        <div className={style.translateToggle}>
            <label className={style.toggleLabel}>
                <div
                    className={`${style.toggle} ${value ? style.toggleActive : ""}`}
                    onClick={() => onChange(v => !v)}
                >
                    <div className={style.toggleThumb} />
                </div>
                <span>Traduire en anglais</span>
            </label>
        </div>
    );
}

export default TranslateToggle;