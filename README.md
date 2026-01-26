# Voice Enricher Desktop

**Sprache zu strukturierten Texten – lokal, privat und flexibel.**

Eine Desktop-App, die gesprochene Worte in aufbereitete Texte verwandelt. Nutzt lokale KI (Ollama) oder Cloud-Dienste (Gemini, OpenAI, OpenRouter).

**Erstellt von Johann Dirschl** – [www.dirschl.com](https://www.dirschl.com)

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
| **FFmpeg** | `brew install ffmpeg` | `winget install ffmpeg` | `apt install ffmpeg` |
| **Ollama** | [Download](https://ollama.com/download) | [Download](https://ollama.com/download/windows) | [Install Script](https://ollama.com/download/linux) |

---

### macOS

```bash
# 1. Homebrew installieren (falls nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. FFmpeg installieren
brew install ffmpeg

# 3. Ollama installieren
brew install ollama
# Oder: Download von https://ollama.com/download

# 4. Ollama Modell laden
ollama pull llama3.2:3b

# 5. Repository klonen und starten
git clone <repo-url>
cd voice-enricher-desktop
npm install
npm run dev
```

**Fertige App nutzen:**
```bash
npm run dist:mac
# → dist/Voice Enricher-1.0.0-arm64.dmg
# DMG öffnen und App in Applications ziehen
```

---

### Windows

```powershell
# 1. FFmpeg installieren (Option A: winget)
winget install ffmpeg

# 1. FFmpeg installieren (Option B: Chocolatey)
choco install ffmpeg

# 1. FFmpeg installieren (Option C: Manuell)
# Download von https://ffmpeg.org/download.html
# Entpacken nach C:\ffmpeg und zu PATH hinzufügen

# 2. Ollama installieren
# Download von https://ollama.com/download/windows
# Installer ausführen

# 3. Ollama Modell laden
ollama pull llama3.2:3b

# 4. Repository klonen und starten
git clone <repo-url>
cd voice-enricher-desktop
npm install
npm run dev
```

**Fertige App erstellen:**
```powershell
npm run dist:win
# → dist/Voice Enricher Setup 1.0.0.exe (Installer)
# → dist/Voice Enricher 1.0.0.exe (Portable)
```

---

### Linux (Ubuntu/Debian)

```bash
# 1. FFmpeg installieren
sudo apt update
sudo apt install ffmpeg

# 2. Ollama installieren
curl -fsSL https://ollama.com/install.sh | sh

# 3. Ollama Modell laden
ollama pull llama3.2:3b

# 4. Repository klonen und starten
git clone <repo-url>
cd voice-enricher-desktop
npm install
npm run dev
```

**Fertige App erstellen:**
```bash
npm run dist:linux
# → dist/Voice Enricher-1.0.0.AppImage
# → dist/voice-enricher-desktop_1.0.0_amd64.deb
```

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

### KI-Provider

| Provider | Kosten | Qualität | Datenschutz |
|----------|--------|----------|-------------|
| **Ollama** | Kostenlos | Gut | 100% lokal |
| **Google Gemini** | Pay-per-use | Sehr gut | Cloud |
| **OpenAI** | Pay-per-use | Exzellent | Cloud |
| **OpenRouter** | Pay-per-use | Variabel | Cloud |

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

```bash
# Development
npm run dev

# Production Build
npm run dist        # Für aktuelles OS
npm run dist:mac    # macOS (.dmg, .zip)
npm run dist:win    # Windows (.exe)
npm run dist:linux  # Linux (.AppImage, .deb)
```

Fertige Installer im `dist/` Ordner.

---

## Projektstruktur

```
voice-enricher-desktop/
├── app/                    # Next.js Frontend
│   ├── page.tsx            # Hauptkomponente
│   ├── api/enrich/         # KI-API Route
│   ├── api/transcribe/     # Whisper-API Route
│   └── globals.css         # Styling
├── electron/
│   ├── main.cjs            # Electron Main Process
│   └── preload.cjs         # IPC Bridge
├── Transcriptions/         # Projektordner (Standard)
└── package.json
```

### Technologien

- **Electron**: Desktop-App mit globalem Hotkey
- **Next.js**: React UI + API Routes
- **Whisper**: Lokale Spracherkennung (@xenova/transformers)
- **Web Speech API**: Alternative Spracherkennung
- **electron-store**: Lokale Einstellungen
- **FFmpeg**: Audio-Konvertierung

---

## Troubleshooting

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

**macOS:**
```bash
brew install ffmpeg
which ffmpeg  # sollte /usr/local/bin/ffmpeg oder /opt/homebrew/bin/ffmpeg zeigen
```

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
