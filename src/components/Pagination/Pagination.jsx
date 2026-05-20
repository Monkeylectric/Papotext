import { ChevronRight, ChevronLeft } from "lucide-react";
import style from "./Pagination.module.css";

function Pagination({ page, totalPages, onPageChange }) {
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
        if (current > 3) pages.push("...");
        for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
            addPage(p);
        };
        if (current < total - 2) pages.push("...");
        addPage(total);

        return pages;
    }
    
    return (
        <div className={style.pagination}>
            <button
                className={style.pageBtn}
                onClick={() => onPageChange(page - 1)}
                disabled={page === 1}
                aria-label="Page précédente"
            >
                <ChevronLeft size={16} />
            </button>

            {buildPageNumbers(page, totalPages).map((p, i) =>
                p === "…" ? (
                    <span key={`ellipsis-${i}`} className={style.pageEllipsis}>…</span>
                ) : (
                    <button
                        key={p}
                        className={`${style.pageBtn} ${p === page ? style.pageBtnActive : ""}`}
                        onClick={() => onPageChange(p)}
                    >
                        {p}
                    </button>
                )
            )}

            <button
                className={style.pageBtn}
                onClick={() => onPageChange(page + 1)}
                disabled={page === totalPages}
                aria-label="Page suivante"
            >
                <ChevronRight size={16} />
            </button>
        </div>
    );
}

export default Pagination;