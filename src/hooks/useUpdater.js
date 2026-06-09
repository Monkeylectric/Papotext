import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useUpdater() {
    const [updateVersion, setUpdateVersion] = useState(null);
    const [installing, setInstalling]       = useState(false);

    useEffect(() => {
        invoke("check_update")
            .then(version => setUpdateVersion(version))
            .catch(() => {}); // silencieux si pas de réseau
    }, []);

    async function installUpdate() {
        setInstalling(true);
        try {
            await invoke("install_update");
        } catch (e) {
            console.error(e);
        } finally {
            setInstalling(false);
        }
    }

    return { updateVersion, installing, installUpdate };
}