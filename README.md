# Voice Enricher Desktop

**Sprache zu strukturierten Texten – lokal, privat und flexibel.**

Eine Desktop-App, die gesprochene Worte in aufbereitete Texte verwandelt. Spracherkennung und KI-Aufbereitung sind getrennt wählbar: lokal (Whisper, Ollama) oder über Cloud-APIs (OpenAI Whisper, Gemini, OpenAI, OpenRouter).

**Erstellt von Johann Dirschl** – [www.dirschl.com](https://www.dirschl.com)

---

## Schnellstart (Fertige App)

| Plattform | Download |
|-----------|----------|
| **macOS (Apple Silicon)** | [Releases](https://github.com/Dirschl/voice-enricher-desktop/releases) → `Voice Enricher-*-arm64.dmg` herunterladen, öffnen, App in „Programme“ ziehen |

- **Ollama** (lokal, empfohlen für KI): [ollama.com](https://ollama.com) installieren, dann z.B. `ollama pull llama3.2:3b`
- **FFmpeg** (für Whisper lokal): **In der App mitgeliefert** – keine Extra-Installation nötig. Optional: In **Einstellungen → Spracherkennung** unter „FFmpeg einrichten“ eine systemweite Installation hinzufügen.

---

## Systemanforderungen

| | Minimum | Empfohlen |
|---|---------|-----------|
| **macOS** | 10.15 (Catalina) | 12+ (Monterey) |
| **Windows** | Windows 10 | Windows 11 |
| **Linux** | Ubuntu 20.04 | Ubuntu 22.04+ |
| **RAM** | 4 GB | 8 GB+ |
| **Speicher** | 2 GB frei | 5 GB+ (für Modelle) |
| **Prozessor** | x64 / ARM64 | Apple Silicon / moderne CPU |

---

## Funktionen im Überblick

### Zwei Aufnahmemodi

| Modus | Beschreibung |
|-------|-------------|
| **Start/Stop** | Schnelle Eingabe – Start, sprechen, Stop. Text erscheint sofort. Ideal für kurze Notizen. Ergänzungen an Cursor Position. Manuelle Texteingabe möglich, wird automatisch gespeichert. Leerzeichen am Anfang/Ende werden erhalten. |
| **Live** | Längere Aufnahmen mit automatischer Segmentierung. Audio wird gespeichert und kann später abgespielt werden. Ergänzungen am Ende incl. Zusammenfassung. Automatische Segmentierung bei Stille (Idle Time konfigurierbar). |

### Projektmanagement

- **Automatisches Speichern**: Jede Aufnahme wird als Projekt gespeichert
- **Projektordner**: `YYYYMMDD_HHMMSS_Projektname` Format
- **Dropdown-Auswahl**: Schneller Zugriff auf letzte Projekte
- **Umbenennen**: Projekte können jederzeit umbenannt werden
- **Export/Import**: Projekte als ZIP-Datei herunterladen oder hochladen
- **Auto-Load**: Importierte Projekte werden automatisch geladen
- **Löschen**: Projekte mit einem Klick entfernen
- **Modus-Anzeige**: Dropdown zeigt "Text" oder "Live" basierend auf Projekttyp

### Audio-Wiedergabe (Live-Modus)

- Segmentierte Transkripte mit Play-Button pro Segment
- Audio-Dateien werden im Projektordner gespeichert
- Nachträgliches Anhören zur Korrektur möglich
- Nicht-Sprach-Tags (z.B. [Musik], [Applaus], [Aufregung]) werden automatisch erkannt und immer angezeigt
- **Unsicher-Markierung (❓):** Segmente mit möglicherweise unsicherer Erkennung (wenige Wörter, Pausen, Dehnungen) sind rot markiert; Tooltip über dem ❓ erklärt den Grund

### KI-Aufbereitung

- **Flexible Prompts**: Beliebig viele eigene Prompts erstellen
- **Drag & Drop**: Prompts per Ziehen sortieren
- **Default-Prompt**: Einen Prompt als Standard festlegen

### Text-to-Speech

- Play-Button neben dem Ergebnis
- Ergebnis wird vorgelesen (macOS native Stimme oder Web Speech API)
- Stoppen jederzeit möglich

### Weitere Features

- **Globaler Hotkey**: `Cmd/Ctrl + Shift + Space` – funktioniert aus jeder App
- **Editierbare Texte**: Transkripte können direkt im Textfeld bearbeitet werden, Änderungen werden automatisch gespeichert
- **Leerzeichen erhalten**: Leerzeichen am Anfang und Ende des Textes werden beim manuellen Bearbeiten erhalten
- **Cursor-Position**: Cursor-Position bleibt beim Tippen erhalten, auch bei Leerzeichen am Anfang
- **Kopieren**: Ein-Klick-Kopieren in die Zwischenablage
- **Idle Time (Live-Modus)**: Konfigurierbare Pausenzeit für automatische Segmentierung (Standard: 3000ms)

---

## Installation

### Voraussetzungen

| Software | macOS | Windows | Linux |
|----------|-------|---------|-------|
| **Node.js** | v18+ | v18+ | v18+ |
| **FFmpeg** | in App enthalten; für Build: `npm run download-ffmpeg` | in App enthalten; für Build: `npm run download-ffmpeg` | in App enthalten; für Build: `npm run download-ffmpeg` |
| **Ollama** | [Download](https://ollama.com/download) | [Download](https://ollama.com/download/windows) | [Install Script](https://ollama.com/download/linux) |

---

### macOS

```bash
# 1. Homebrew installieren (falls nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Ollama installieren
brew install ollama
# Oder: Download von https://ollama.com/download

# 3. Ollama Modell laden
ollama pull llama3.2:3b

# 4. Repository klonen und starten
git clone https://github.com/Dirschl/voice-enricher-desktop.git
cd voice-enricher-desktop
npm install
npm run download-ffmpeg   # FFmpeg-Binaries für Dev/Build (resources/ffmpeg)
npm run dev
```

**Fertige App aus dem Quellcode:**
```bash
npm run dist:mac
# → dist/Voice Enricher-<Version>-arm64.dmg (Apple Silicon)
# DMG öffnen und App in „Programme“ ziehen
```

Oder vorkompilierte **Releases** von [GitHub](https://github.com/Dirschl/voice-enricher-desktop/releases) herunterladen.

---

### Windows

```powershell
# 1. Ollama installieren
# Download von https://ollama.com/download/windows
# Installer ausführen

# 2. Ollama Modell laden
ollama pull llama3.2:3b

# 3. Repository klonen und starten
git clone https://github.com/Dirschl/voice-enricher-desktop.git
cd voice-enricher-desktop
npm install
npm run download-ffmpeg   # FFmpeg-Binaries für Dev/Build (resources/ffmpeg)
npm run dev
```

**Fertige App erstellen:** `npm run dist:win` → `dist/` (Installer + Portable).  
Oder [Releases](https://github.com/Dirschl/voice-enricher-desktop/releases) (Windows-Builds, falls vorhanden).

---

### Linux (Ubuntu/Debian)

```bash
# 1. Ollama installieren
curl -fsSL https://ollama.com/install.sh | sh

# 2. Ollama Modell laden
ollama pull llama3.2:3b

# 3. Repository klonen und starten
git clone https://github.com/Dirschl/voice-enricher-desktop.git
cd voice-enricher-desktop
npm install
npm run download-ffmpeg   # FFmpeg-Binaries für Dev/Build (resources/ffmpeg)
npm run dev
```

**Fertige App erstellen:** `npm run dist:linux` → `dist/` (AppImage, .deb).  
Oder [Releases](https://github.com/Dirschl/voice-enricher-desktop/releases) (Linux-Builds, falls vorhanden).

---

### Plattform-Features

| Feature | macOS | Windows | Linux |
|---------|-------|---------|-------|
| Spracherkennung (Whisper) | ✓ | ✓ | ✓ |
| KI-Aufbereitung (Ollama) | ✓ | ✓ | ✓ |
| Text-to-Speech | `say` (Anna) | PowerShell SAPI | `espeak` |
| Globaler Hotkey | `Cmd+Shift+Space` | `Ctrl+Shift+Space` | `Ctrl+Shift+Space` |
| Mikrofon-Berechtigung | System-Dialog | Automatisch | Automatisch |
| Native Menüleiste | ✓ | Standard | Standard |

---

## Benutzung

### Start/Stop-Modus (Schnelleingabe)

1. Modus "Start/Stop" wählen
2. Auf "Aufnahme starten" klicken oder Hotkey drücken
3. Sprechen
4. Erneut klicken oder Hotkey drücken → Aufnahme stoppt
5. Text erscheint, optional mit KI aufbereiten
6. **Manuelle Bearbeitung**: Text direkt im Textfeld bearbeiten, Änderungen werden automatisch gespeichert
7. **Leerzeichen**: Leerzeichen am Anfang/Ende können eingegeben werden und bleiben erhalten

### Live-Modus (Längere Aufnahmen)

1. Modus "Live" wählen
2. Optional: "+ Neu" für Projektnamen
3. Aufnahme starten
4. Sprechen – Text wird automatisch in Segmenten angezeigt (bei Stille = Idle Time)
5. **Idle Time**: Konfigurierbare Pausenzeit in Einstellungen (Standard: 3000ms)
6. Aufnahme stoppen (sofortiges Stoppen möglich, Verarbeitung läuft im Hintergrund)
7. Segmente einzeln abspielen oder bearbeiten
8. Mit "KI Prompt verarbeiten" aufbereiten

### Ergebnis nutzen

- **Kopieren**: Klick auf Kopieren-Symbol
- **Vorlesen**: Klick auf Play-Symbol
- **Bearbeiten**: Transkript direkt im Textfeld ändern, wird automatisch gespeichert (Start/Stop-Modus)
- **KI Prompt verarbeiten**: Button zum erneuten Verarbeiten des Textes mit dem aktuellen Prompt

---

## Einstellungen

### Spracherkennung (STT)

Spracherkennung und KI-Aufbereitung sind **unabhängig** wählbar – du kannst z.B. Whisper lokal und Ollama für die KI nutzen.

| Provider | Beschreibung | API-Key |
|----------|--------------|---------|
| **Whisper lokal** | Läuft offline (@xenova/transformers). Modelle: Tiny, Base, Small. | – |
| **Whisper API (OpenAI)** | Schnell, gut, ~0,5 Cent/Min. Für Start/Stop und Live-Modus. | OpenAI-Key in Einstellungen → Spracherkennung |
| **Web Speech API** | Kostenlos, benötigt Internet (Google). Instabil. | – |

Der **Whisper-API-Key** ist getrennt vom **LLM-API-Key** (Gemini/OpenAI/OpenRouter).

### KI-Provider (LLM)

| Provider | Kosten | Qualität | Datenschutz |
|----------|--------|----------|-------------|
| **Ollama** | Kostenlos | Gut | 100% lokal |
| **Google Gemini** | Pay-per-use | Sehr gut | Cloud |
| **OpenAI** | Pay-per-use | Exzellent | Cloud |
| **OpenRouter** | Pay-per-use | Variabel | Cloud |

Für Gemini, OpenAI und OpenRouter wird der **LLM-API-Key** in Einstellungen → KI-Provider eingetragen (nur sichtbar, wenn der entsprechende Provider gewählt ist).

### Modellauswahl

- Vordefinierte Modelle pro Provider (empfohlene und weitere)
- Eigene Modelle eintragen möglich
- Bei Ollama: Modelle direkt aus der App installieren

### Live-Modus Einstellungen

- **Idle Time**: Pausenzeit in Millisekunden für automatische Segmentierung (Standard: 3000ms)
- Während der Aufnahme wird ein visueller Countdown angezeigt
- Bei Erreichen der Idle Time wird das aktuelle Segment automatisch gespeichert und verarbeitet

### Prompts verwalten

1. Register "Prompts" öffnen
2. Prompts bearbeiten, erstellen oder löschen
3. Reihenfolge per Drag & Drop ändern
4. Standard-Prompt im Dropdown festlegen

### Textbearbeitung

- **Start/Stop-Modus**: Transkript kann direkt im Textfeld bearbeitet werden
- **Automatisches Speichern**: Änderungen werden nach 500ms automatisch gespeichert
- **Leerzeichen**: Leerzeichen am Anfang und Ende des Textes werden erhalten
- **Cursor-Position**: Cursor-Position bleibt beim Tippen erhalten
- **Live-Modus**: Segmente können einzeln bearbeitet werden

---

## Build & Distribution

**Vorkompilierte Versionen:** [GitHub Releases](https://github.com/Dirschl/voice-enricher-desktop/releases) (macOS Apple Silicon: .dmg, .zip).

**Selbst bauen:**
```bash
npm run dev          # Development
npm run dist         # Für aktuelles OS
npm run dist:mac     # macOS (.dmg, .zip)
npm run dist:win     # Windows (.exe)
npm run dist:linux   # Linux (.AppImage, .deb)
```

Fertige Artefakte im Ordner `dist/`.

---

## Projektstruktur

```
voice-enricher-desktop/
├── app/                    # Next.js Frontend
│   ├── page.tsx            # Hauptkomponente
│   ├── api/enrich/         # KI-API (Ollama, Gemini, OpenAI, OpenRouter)
│   ├── api/transcribe/     # Whisper-API (OpenAI)
│   ├── api/convert-audio/  # Audio → Float32 (FFmpeg)
│   ├── api/ollama-setup/   # Ollama-Installation & Modell-Pull
│   └── globals.css         # Styling
├── electron/
│   ├── main.cjs            # Electron Main Process
│   └── preload.cjs         # IPC Bridge
├── build/                  # Icons, Entitlements (für Signing/Build)
├── Transcriptions/         # Projektordner (Standard, wird angelegt)
└── package.json
```

### Technologien

- **Electron**: Desktop-App mit globalem Hotkey
- **Next.js**: React UI + API Routes
- **Whisper**: Lokale Spracherkennung (@xenova/transformers) oder OpenAI Whisper API
- **Web Speech API**: Alternative Spracherkennung (optional)
- **electron-store**: Lokale Einstellungen
- **FFmpeg**: Audio-Konvertierung

---

## Troubleshooting

### App startet nicht / Fenster bleibt unsichtbar

- Das Fenster erscheint spätestens nach **10 Sekunden** (Timeout-Fallback). Bei Load-Fehlern (z.B. Port 3000 belegt) wird es sofort angezeigt.
- **View → Reload** (oder `Cmd+R`) nach Fehlern oder weißer Seite.
- Im **Dev-Modus** (`npm run dev`): Erst warten, bis Next.js „Ready“ meldet, dann startet Electron. Bei `EADDRINUSE` auf Port 3000: anderen Prozess beenden oder Port ändern.

### „OpenAI API Key für Whisper fehlt“

- Wenn **Whisper API (OpenAI)** als Spracherkennung gewählt ist: In **Einstellungen → Spracherkennung** das Feld **„OpenAI API Key (für Whisper)“** ausfüllen. Dieser Key ist getrennt vom LLM-API-Key.

### Mikrofon funktioniert nicht

**macOS:**
- Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon
- "Voice Enricher" muss aktiviert sein
- Bei Problemen: App löschen, neu installieren, beim ersten Start erlauben

**Windows:**
- Einstellungen → Datenschutz → Mikrofon
- "Apps den Zugriff auf Ihr Mikrofon erlauben" aktivieren

**Linux:**
- PulseAudio/PipeWire muss laufen
- `pavucontrol` für Audio-Einstellungen

### FFmpeg nicht gefunden

FFmpeg ist in der App enthalten; der Fehler sollte nur bei kaputtem Build oder älteren Versionen auftreten.

**In der App:** Einstellungen → Spracherkennung (bei „Whisper lokal“) → **„FFmpeg einrichten“** (Installation per Homebrew/winget/apt). Die App verwendet danach die systemweite Installation.

**Manuell (Fallback):**
**macOS:** `brew install ffmpeg` (oder `/opt/homebrew/bin/ffmpeg`, `/usr/local/bin/ffmpeg`)

**Windows:**
```powershell
winget install ffmpeg
# Oder: FFmpeg von https://ffmpeg.org herunterladen
# Entpacken nach C:\ffmpeg\bin und zu PATH hinzufügen
ffmpeg -version  # Test
```

**Linux:**
```bash
sudo apt install ffmpeg
ffmpeg -version  # Test
```

### Ollama antwortet nicht

**Alle Plattformen:**
```bash
ollama list      # Prüfen ob installiert
ollama serve     # Manuell starten
curl http://localhost:11434/api/tags  # API testen
```

**Windows-spezifisch:**
- Firewall kann Ollama blockieren
- Ollama als Administrator starten

### Transkription ungenau
- Deutlicher sprechen, weniger Hintergrundgeräusche
- Anderes Whisper-Modell in Einstellungen wählen (größer = genauer, aber langsamer)
- Sprache in Einstellungen korrekt setzen

### TTS (Vorlesen) funktioniert nicht

**macOS:** Funktioniert automatisch mit `say`

**Windows:** PowerShell muss verfügbar sein (Standard bei Windows 10/11)

**Linux:** 
```bash
sudo apt install espeak
espeak "Test"  # Sollte "Test" sprechen
```

---

## Lizenz

MIT License – Frei nutzbar und anpassbar.

---

**Voice Enricher Desktop** von Johann Dirschl | [www.dirschl.com](https://www.dirschl.com)
