<div align="center">

<img src="public/papotext.svg" alt="Logo Papotext" width="96" />

# Papotext

**Transcription audio 100 % locale, rapide et privée.**
Vos fichiers et votre voix ne quittent jamais votre ordinateur.

![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-2021-000000?logo=rust&logoColor=white)
![Whisper](https://img.shields.io/badge/Whisper-whisper.cpp-412991)
![Version](https://img.shields.io/badge/version-1.0.0-blue)

</div>

---

## Sommaire

- [À propos](#à-propos)
- [Fonctionnalités](#fonctionnalités)
- [Aperçu technique](#aperçu-technique)
- [Prérequis](#prérequis)
- [Installation et lancement](#installation-et-lancement)
- [Compilation](#compilation)
- [Utilisation](#utilisation)
- [Modèles Whisper](#modèles-whisper)
- [Architecture du projet](#architecture-du-projet)
- [Fonctionnement interne](#fonctionnement-interne)
- [Données et confidentialité](#données-et-confidentialité)
- [Mises à jour automatiques](#mises-à-jour-automatiques)
- [Feuille de route](#feuille-de-route)
- [Contribuer](#contribuer)
- [Licence](#licence)

---

## À propos

**Papotext** est une application de bureau de transcription audio. Elle s'appuie sur
[Whisper](https://github.com/openai/whisper), exécuté localement grâce à
[`whisper.cpp`](https://github.com/ggerganov/whisper.cpp) (via le crate Rust
[`whisper-rs`](https://crates.io/crates/whisper-rs)), au sein d'une interface
[Tauri 2](https://tauri.app/) + [React 19](https://react.dev/).

Aucune donnée n'est envoyée à un service tiers pour la transcription : le traitement
s'effectue entièrement sur votre machine, sans compte ni abonnement. Un modèle Whisper
(*Small*) est embarqué avec l'application, qui fonctionne donc **dès le premier
lancement, hors connexion**.

## Fonctionnalités

### Transcription
- **Transcription de fichiers audio** aux formats `wav`, `mp3`, `ogg`, `flac` et `m4a`.
- **Transcription en direct** depuis le microphone, avec découpage automatique par détection de silence.
- **Choix de la langue** : détection automatique ou sélection parmi 12 langues
  (français, anglais, espagnol, allemand, italien, portugais, néerlandais, russe, arabe, chinois, japonais, coréen).
- **Traduction vers l'anglais** en option.
- **Progression en temps réel** et **annulation** d'une transcription en cours.

### Performances
- **Traitement parallèle** des longs fichiers grâce à un pool de contextes Whisper.
- **Dimensionnement automatique du pool selon la RAM** disponible, pour éviter la saturation mémoire.
- **Curseur d'utilisation CPU** (25 % → 100 %) pour équilibrer vitesse et réactivité du système.
- **Pré-traitement audio** via FFmpeg (filtrage, réduction de bruit, compression dynamique, normalisation) pour améliorer la qualité de reconnaissance.

### Historique et export
- **Historique persistant** (SQLite) avec recherche plein texte et pagination.
- **Lecteur audio intégré** pour réécouter l'enregistrement associé.
- **Édition** du texte transcrit après coup.
- **Export `.txt`** et **export `.srt`**.
- **Statistiques** : nombre total de transcriptions, modèle le plus utilisé, dernier fichier traité.

### Gestion des modèles
- Téléchargement de modèles Whisper depuis HuggingFace.
- **Import d'un modèle local** (`.bin`) depuis n'importe quel emplacement.
- Suppression des modèles inutilisés (le modèle par défaut est protégé).
- **Avertissement** lorsqu'un modèle est trop volumineux pour la RAM de la machine.

### Interface
- Thème **clair / sombre / automatique**.
- Interface **bilingue français / anglais** (détection automatique de la langue du système).
- Notification de **mise à jour** intégrée.

## Aperçu technique

| Couche | Technologies |
| --- | --- |
| Interface | React 19, Vite 7, CSS Modules, `lucide-react` |
| Internationalisation | `i18next`, `react-i18next`, `i18next-browser-languagedetector` |
| Shell applicatif | Tauri 2 (plugins : dialog, store, shell, http, opener, updater) |
| Backend | Rust (édition 2021), Tokio, `rusqlite` (SQLite embarqué), `sysinfo`, `hound`, `reqwest` |
| Reconnaissance vocale | `whisper-rs` 0.16 (`whisper.cpp`) |
| Traitement audio | FFmpeg embarqué (sidecar Tauri) |

## Prérequis

- [Node.js](https://nodejs.org/) (version LTS récente) et npm
- [Rust](https://www.rust-lang.org/tools/install) (toolchain stable)
- Les [prérequis système de Tauri 2](https://v2.tauri.app/start/prerequisites/) pour votre plateforme
- Une chaîne de compilation C/C++ et [CMake](https://cmake.org/), nécessaires à la compilation de `whisper.cpp` par `whisper-rs`
- [Git LFS](https://git-lfs.com/), car le modèle par défaut et le binaire FFmpeg sont versionnés avec LFS

> **Important :** installez Git LFS **avant** de cloner le dépôt. Sans lui, les fichiers
> volumineux comme `ggml-small.bin` (465 Mo) et `ffmpeg-x86_64-pc-windows-msvc.exe` ne seront
> que de simples fichiers pointeurs et l'application ne démarrera pas.

## Installation et lancement

```bash
# Installer Git LFS (une seule fois par machine)
git lfs install

# Cloner le dépôt
git clone https://github.com/Monkeylectric/Papotext.git
cd Papotext

# (si le dépôt a été cloné avant l'installation de Git LFS)
git lfs pull

# Installer les dépendances front-end
npm install

# Lancer l'application en mode développement
npm run tauri dev
```

Le serveur Vite écoute sur le port `1420`.

### Binaire FFmpeg selon la plateforme

Le dépôt fournit uniquement `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe`
(Windows x64). Tauri exige que le sidecar soit nommé selon le *target triple* de la
plateforme cible. Sur une autre plateforme, ajoutez un binaire FFmpeg correspondant dans
`src-tauri/binaries/`, par exemple :

| Plateforme | Nom attendu |
| --- | --- |
| Windows x64 | `ffmpeg-x86_64-pc-windows-msvc.exe` |
| macOS Apple Silicon | `ffmpeg-aarch64-apple-darwin` |
| macOS Intel | `ffmpeg-x86_64-apple-darwin` |
| Linux x64 | `ffmpeg-x86_64-unknown-linux-gnu` |

Vous pouvez obtenir votre *target triple* avec `rustc -vV` (champ `host`).

## Compilation

```bash
npm run tauri build
```

Les installateurs sont générés dans `src-tauri/target/release/bundle/`. Le profil
*release* est optimisé (`opt-level = 3`, LTO, un seul *codegen unit*, symboles retirés).

## Utilisation

**Transcription** - importez un fichier audio, choisissez la langue (ou laissez la
détection automatique), activez la traduction vers l'anglais si besoin, puis
lancez la transcription. Le résultat peut être copié ou enregistré dans l'historique.
**Direct** - démarrez l'enregistrement : le texte apparaît au fil de la parole,
par blocs délimités par les silences.
**Historique** - retrouvez, recherchez, réécoutez, corrigez et exportez
(`.txt` / `.srt`) vos transcriptions passées.
**Paramètres** - gérez les modèles Whisper et réglez l'utilisation du CPU.

## Modèles Whisper

Le modèle **Small** est livré avec l'application. D'autres modèles peuvent être
téléchargés depuis les paramètres (source : le dépôt HuggingFace
[`ggerganov/whisper.cpp`](https://huggingface.co/ggerganov/whisper.cpp)).

| Modèle | Fichier | Taille approx. |
| --- | --- | --- |
| Tiny | `ggml-tiny.bin` | 75 Mo |
| Base | `ggml-base.bin` | 142 Mo |
| **Small** *(par défaut)* | `ggml-small.bin` | 466 Mo |
| Medium | `ggml-medium.bin` | 1,5 Go |
| Medium (léger, quantifié) | `ggml-medium-q5_0.bin` | 539 Mo |
| Large | `ggml-large.bin` | 2,9 Go |
| Large (léger, quantifié) | `ggml-large-v2-q5_0.bin` | 1,08 Go |

Plus un modèle est grand, plus la transcription est précise, mais plus elle est lente
et gourmande en mémoire. Les modèles sont stockés dans le dossier de données locales
de l'application (`<app_local_data_dir>/models`). Vous pouvez aussi importer n'importe
quel modèle au format `ggml` (`.bin`) compatible avec `whisper.cpp`.

## Architecture du projet

```
Papotext/
├── index.html
├── package.json
├── vite.config.js            # Alias @, @components, @pages, @hooks, @utils, @assets
├── public/                   # Ressources statiques (logo...)
├── src/                      # Frontend React
│   ├── main.jsx · App.jsx    # Point d'entrée, navigation, thème
│   ├── pages/
│   │   ├── Main/             # Transcription (fichier + direct)
│   │   ├── History/          # Historique, recherche, édition, export
│   │   └── Settings/         # Modèles et utilisation CPU
│   ├── components/           # Composants UI réutilisables (CSS Modules)
│   ├── hooks/useUpdater.js   # Détection des mises à jour
│   ├── utils/silenceDetector.js  # Détection de silence (Web Audio API)
│   └── i18n/                 # Traductions fr / en + gestion des erreurs
└── src-tauri/                # Backend Rust
    ├── tauri.conf.json       # Configuration Tauri (bundle, sidecar, updater)
    ├── capabilities/         # Permissions de la fenêtre principale
    ├── binaries/             # Sidecar FFmpeg (Git LFS)
    ├── models/               # Modèle Whisper embarqué (Git LFS)
    └── src/
        ├── lib.rs            # État global, pool Whisper, commandes exposées
        ├── audio.rs          # Pipeline audio + transcription (fichier, direct)
        ├── models.rs         # Téléchargement, import, suppression de modèles
        ├── history.rs        # SQLite, export TXT/SRT, statistiques
        ├── settings.rs       # Préférences persistantes, informations RAM
        ├── updater.rs        # Vérification des mises à jour
        └── errors.rs         # Erreurs sous forme de clés i18n
```

## Fonctionnement interne

### Transcription d'un fichier

**Conversion** : FFmpeg convertit la source en WAV mono 16 kHz et applique la chaîne de filtres
(passe-haut 80 Hz, passe-bas 8 kHz, réduction de bruit, compresseur, normalisation `loudnorm`).
**Fichiers courts (< 60 s)** : transcription directe en un seul passage.
**Fichiers longs** : détection des silences (`silencedetect`), puis découpage en segments d'environ
30 secondes aux points de silence.
**Parallélisation** : les segments sont répartis sur un pool de contextes Whisper. La taille du pool est
plafonnée pour n'utiliser qu'environ la moitié de la RAM totale, en tenant compte de la taille du modèle.
**Décodage** : *beam search* (taille 5, ramenée à 3 au-delà de 30 minutes), température 0 pour des
résultats déterministes.
**Assemblage** : le texte et les segments horodatés sont recomposés dans l'ordre et sauvegardés.

### Transcription en direct

Le microphone est enregistré via `MediaRecorder`. Un détecteur de silence basé sur la
Web Audio API découpe le flux en blocs : un bloc est envoyé au backend
après une durée minimale de 1,5 s, lorsque 0,5 s de silence continu est détecté.
Chaque bloc est converti puis transcrit avec une chaîne de filtres allégée pour limiter la latence.

### Communication frontend / backend

Le frontend appelle les commandes Rust via `invoke` (transcription, modèles, historique,
paramètres) et reçoit les événements `transcription_progress`, `transcription_chunk`,
`download_progress` et `download_complete`. Les erreurs du backend sont renvoyées sous
forme de clés de traduction (éventuellement accompagnées d'un détail JSON), traduites ensuite côté interface.

## Données et confidentialité

- La transcription est **exécutée localement** ; aucun contenu audio ou textuel n'est transmis.
- L'historique est stocké dans une base **SQLite locale** ; les préférences, dans un fichier `settings.json` géré par `tauri-plugin-store`.
- Les seules communications réseau sont : le **téléchargement optionnel de modèles** (HuggingFace) et la **vérification des mises à jour**.

## Mises à jour automatiques

L'application interroge un point de terminaison de mise à jour (configuré dans
`src-tauri/tauri.conf.json`, section `plugins.updater`) et signale la disponibilité d'une
nouvelle version dans la barre latérale. Les mises à jour sont vérifiées par signature
à l'aide de la clé publique déclarée dans la configuration.

## Contribuer

Les contributions sont les bienvenues.

- Forkez le dépôt et créez une branche : `git checkout -b feature/ma-fonctionnalite`
- Commitez vos changements avec un message explicite
- Poussez la branche et ouvrez une *pull request* décrivant le changement

Pour signaler un bug ou proposer une idée, ouvrez une
[issue](https://github.com/Monkeylectric/Papotext/issues).