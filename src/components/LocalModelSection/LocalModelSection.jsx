import { FolderOpen } from "lucide-react";
import style from "./LocalModelSection.module.css";

function LocalModelSection({ onSelectFile }) {
    return (
        <>
            <p className={style.desc}>
                Tu peux télécharger manuellement un modèle depuis{" "}
                <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank">
                    HuggingFace
                </a>{" "}
                et le sélectionner ici.
            </p>
            <button className={style.btnLocal} onClick={onSelectFile}>
                <FolderOpen size={16} /> Sélectionner un fichier .bin local
            </button>
        </>
    );
}

export default LocalModelSection;