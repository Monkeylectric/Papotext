import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export function useUpdater() {
    const [updateVersion, setUpdateVersion] = useState(null);

    useEffect(() => {
        invoke("check_update")
            .then(version => setUpdateVersion(version))
            .catch(() => {}); // silencieux si pas de réseau
    }, []);

    return { updateVersion };
}