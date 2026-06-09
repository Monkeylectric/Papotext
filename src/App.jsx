import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Mic, ClipboardList, Settings as SettingsLucid, Sun, Moon, Loader2, Download } from "lucide-react";
import { useUpdater } from "@hooks/useUpdater";
import logo from "@assets/logo.svg";
import Main from "@pages/Main/Main";
import History from "@pages/History/History";
import Settings from "@pages/Settings/Settings";
import ConfirmModal from "@components/ConfirmModal/ConfirmModal";
import styles from "./App.module.css";

function App() {
    const [page, setPage] = useState("main");
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "auto";
    });
    const { t }                                             = useTranslation();
    const [isTranscribing, setIsTranscribing]               = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(null);
    const [transcriptionError, setTranscriptionError]       = useState("");
    const [showCancelConfirm, setShowCancelConfirm]         = useState(false);
    const [isCancelling, setIsCancelling]                   = useState(false);
    const { updateVersion, installing, installUpdate }      = useUpdater();
    
    useEffect(() => {
        if (theme === "auto") {
            document.documentElement.removeAttribute("data-theme");
        } else {
            document.documentElement.setAttribute("data-theme", theme);
        }

        localStorage.setItem("theme", theme);
    }, [theme]);
    
    function toggleTheme() {
        setTheme(t => {
            if (t === "auto" || t === "light") return "dark";

            return "light";
        });
    }

    async function cancelTranscription() {
        setIsCancelling(true);

        await invoke("cancel_transcription");

        setIsTranscribing(false);
        setTranscriptionProgress(null);
        setIsCancelling(false);
    }
    
    const isDark = theme === "dark" ||
        (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const navItems = [
        { id: "main",     icon: <Mic size={17} />,          label: `${t("nav.transcription")}`, badge: isTranscribing },
        { id: "history",  icon: <ClipboardList size={17} />, label: `${t("nav.history")}` },
        { id: "settings", icon: <SettingsLucid size={17} />, label: `${t("nav.settings")}` },
    ];
    
    return (
        <div className={styles.app}>
            {showCancelConfirm && (
                <ConfirmModal
                    title={t("confirm.cancelTranscription")}
                    message={t("confirm.cancelTranscriptionMsg")}
                    onConfirm={() => {
                        setShowCancelConfirm(false);
                        cancelTranscription();
                    }}
                    onCancel={() => setShowCancelConfirm(false)}
                    confirmLabel={t("confirm.cancelTranscriptionBtn")}
                />
            )}

            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarTitle}>
                    <img src={logo} alt="Papotext" height={30} /> Papotext
                </div>
        
                <nav>
                {navItems.map(item => (
                    <button
                        key={item.id}
                        className={`${styles.navButton} ${page === item.id ? styles.navButtonActive : ""}`}
                        onClick={() => setPage(item.id)}
                    >
                        {item.icon} {item.label}
                        {item.badge && (
                            <span className={styles.navBadge}>
                                <Loader2 size={12} className="spinning" />
                            </span>
                        )}
                    </button>
                ))}
                </nav>

                {isTranscribing && page !== "main" && (
                    <div className={styles.transcribingBanner}>
                        <Loader2 size={13} className="spinning" />
                        <span>
                            {t("main.transcribing")}
                            {transcriptionProgress ? ` - ${transcriptionProgress.percent}%` : "..."}
                        </span>
                    </div>
                )}

                {updateVersion && (
                    <div className={styles.updateBanner}>
                        <span>v{updateVersion} disponible</span>
                        <button onClick={installUpdate} disabled={installing}>
                            {installing
                                ? <Loader2 size={12} className="spinning" />
                                : <Download size={12} />
                            }
                        </button>
                    </div>
                )}
        
                <div className={styles.themeToggle}>
                    <button className={styles.themeButton} onClick={toggleTheme}>
                        {isDark ? <><Sun size={15} /> {t("theme.light")}</> : <><Moon size={15} /> {t("theme.dark")}</>}
                    </button>
                </div>
            </aside>
        
            {/* Contenu */}
            <main className={styles.content}>
                {page === "main" && (
                    <Main
                        isTranscribing={isTranscribing}
                        onTranscribingChange={setIsTranscribing}
                        transcriptionProgress={transcriptionProgress}
                        onProgressChange={setTranscriptionProgress}
                        isCancelling={isCancelling}
                        onCancel={() => setShowCancelConfirm(true)}
                        transcriptionError={transcriptionError}
                        onErrorChange={setTranscriptionError}
                    />
                )}
                {page === "history"  && <History />}
                {page === "settings" && <Settings />}
            </main>
        </div>
    );
}

export default App;
