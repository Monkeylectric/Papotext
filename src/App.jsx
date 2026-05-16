import { useState, useEffect } from "react";
import { Mic, ClipboardList, Settings as SettingsLucid, Sun, Moon } from "lucide-react";
import Main from "./pages/Main/Main";
import History from "./pages/History/History";
import Settings from "./pages/Settings/Settings";
import styles from "./App.module.css";

function App() {
    const [page, setPage] = useState("main");
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem("theme") || "auto";
    });
    
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
    
    return (
        <div className={styles.app}>
            {/* Sidebar */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarTitle}>
                    <Mic size={16} /> Papotext
                </div>
        
                <nav>
                {[
                    { id: "main",     icon: <Mic size={17} />, label: "Transcription" },
                    { id: "history",  icon: <ClipboardList size={17} />, label: "Historique" },
                    { id: "settings", icon: <SettingsLucid size={17} />, label: "Paramètres" },
                ].map(item => (
                    <button
                        key={item.id}
                        className={`${styles.navButton} ${page === item.id ? styles.navButtonActive : ""}`}
                        onClick={() => setPage(item.id)}
                    >
                    {item.icon} {item.label}
                    </button>
                ))}
                </nav>
        
                <div className={styles.themeToggle}>
                    <button className={styles.themeButton} onClick={toggleTheme}>
                        {isDark ? <><Sun size={15} /> Mode clair</> : <><Moon size={15} /> Mode sombre</>}
                    </button>
                </div>
            </aside>
        
            {/* Contenu */}
            <main className={styles.content}>
                {page === "main"     && <Main />}
                {page === "history"  && <History />}
                {page === "settings" && <Settings />}
            </main>
        </div>
    );
}

export default App;
