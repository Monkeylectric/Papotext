import { useState } from "react";
import { useTranslation } from "react-i18next";
import style from "./SegmentedText.module.css";

const TRUNCATE_LIMIT = 2000;

function SegmentedText({ text, segments, activeSegIdx, readonly = false }) {
    const { t }                   = useTranslation();
    const [expanded, setExpanded] = useState(false);

    // Pas de truncation si audio actif
    const shouldTruncate = !segments && !readonly && text?.length > TRUNCATE_LIMIT;
    const displayText = shouldTruncate && !expanded
        ? text.slice(0, TRUNCATE_LIMIT)
        : text;

    const content = segments?.length > 0
        ? segments.map((seg, idx) => (
            <span
                key={idx}
                className={idx === activeSegIdx ? style.segmentHighlight : style.segment}
            >
                {seg.text}{" "}
            </span>
        ))
        : displayText;

    return (
        <div className={`${style.text} ${readonly ? style.readonly : ""}`}>
            {content}
            {shouldTruncate && !expanded && (
                <>
                    <span className={style.truncateEllipsis}>...</span>
                    <button className={style.btnExpand} onClick={() => setExpanded(true)}>
                        {t("edit.expand", { count: text.length })}
                    </button>
                </>
            )}
        </div>
    );
}

export default SegmentedText;