import { Trans, useTranslation } from "react-i18next";
import { FolderOpen } from "lucide-react";
import style from "./LocalModelSection.module.css";

function LocalModelSection({ onSelectFile }) {
    const { t } = useTranslation();
    
    return (
        <>
            <p className={style.desc}>
                <Trans
                    i18nKey="settings.localDesc"
                    components={[
                        <a href="https://huggingface.co/ggerganov/whisper.cpp" target="_blank" />,
                    ]}
                />
            </p>
            <button className={style.btnLocal} onClick={onSelectFile}>
                <FolderOpen size={16} /> {t("actions.selectLocalFile")}
            </button>
        </>
    );
}

export default LocalModelSection;