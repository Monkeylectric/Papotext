import style from "./SegmentedText.module.css";

function SegmentedText({ text, segments, activeSegIdx, readonly = false }) {
    const content = segments?.length > 0
        ? segments.map((seg, idx) => (
            <span
                key={idx}
                className={idx === activeSegIdx ? style.segmentHighlight : style.segment}
            >
                {seg.text}{" "}
            </span>
        ))
        : text;

    return (
        <div className={`${style.text} ${readonly ? style.readonly : ""}`}>
            {content}
        </div>
    );
}

export default SegmentedText;