import { Trash2 } from "lucide-react";
import styles from "./ConfirmModal.module.css";

function ConfirmModal({ title, message, onConfirm, onCancel }) {
    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.iconWrapper}>
                    <Trash2 size={20} />
                </div>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.message}>{message}</p>
                <div className={styles.actions}>
                    <button className={styles.btnCancel} onClick={onCancel}>
                        Annuler
                    </button>
                    <button className={styles.btnConfirm} onClick={onConfirm}>
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmModal;