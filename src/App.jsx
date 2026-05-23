import { useState, useEffect } from "react";
import { Mic, ClipboardList, Settings as SettingsLucid, Sun, Moon, Loader2 } from "lucide-react";
import Main from "@pages/Main/Main";
import History from "@pages/History/History";
import Settings from "@pages/Settings/Settings";
import styles from "./App.module.css";

function App() {
    const [page, setPage] = useState("main");
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "auto";
    });
    const [isTranscribing, setIsTranscribing]               = useState(false);
    const [transcriptionProgress, setTranscriptionProgress] = useState(null);
    const [transcriptionError, setTranscriptionError]       = useState("");
    
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
    
    const isDark = theme === "dark" ||
        (theme === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);

    const navItems = [
        { id: "main",     icon: <Mic size={17} />,          label: "Transcription", badge: isTranscribing },
        { id: "history",  icon: <ClipboardList size={17} />, label: "Historique" },
        { id: "settings", icon: <SettingsLucid size={17} />, label: "Paramètres" },
    ];
    
    return (
        <div className={styles.app}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarTitle}>
                    <Mic size={16} /> Papotext
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
                            Transcription en cours
                            {transcriptionProgress ? ` - ${transcriptionProgress.percent}%` : "..."}
                        </span>
                    </div>
                )}
        
                <div className={styles.themeToggle}>
                    <button className={styles.themeButton} onClick={toggleTheme}>
                        {isDark ? <><Sun size={15} /> Mode clair</> : <><Moon size={15} /> Mode sombre</>}
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
