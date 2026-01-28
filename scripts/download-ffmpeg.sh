#!/bin/bash
# Lädt FFmpeg-Binaries für macOS, Windows und Linux in resources/ffmpeg/{mac,win,linux}.
# Quellen: evermeet.cx (macOS Intel), BtbN/FFmpeg-Builds (Windows, Linux).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/resources/ffmpeg"
mkdir -p "$RES"/{mac,win,linux}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== macOS (Intel, läuft auch auf Apple Silicon via Rosetta) ==="
curl -fsSL -L -o "$TMP/ffmpeg-mac.zip" "https://evermeet.cx/ffmpeg/get/zip"
unzip -j -o "$TMP/ffmpeg-mac.zip" -d "$RES/mac"
# Evermeet-Zip: eine Datei, ggf. "ffmpeg" oder "ffmpeg-..."; immer als ffmpeg ablegen
for f in "$RES/mac"/*; do [ -f "$f" ] && [ "$(basename "$f")" != "ffmpeg" ] && mv "$f" "$RES/mac/ffmpeg"; break; done
chmod +x "$RES/mac/ffmpeg"
# Quarantine auf macOS entfernen (für gebündelte App)
if [[ "$(uname)" == "Darwin" ]]; then xattr -cr "$RES/mac/ffmpeg" 2>/dev/null || true; fi
echo "  -> $RES/mac/ffmpeg"

echo "=== Windows (x64) ==="
curl -fsSL -o "$TMP/ffmpeg-win.zip" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
unzip -o "$TMP/ffmpeg-win.zip" -d "$TMP/win"
# Pfad im Archiv: ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe
WIN_DIR=$(find "$TMP/win" -maxdepth 1 -type d -name "ffmpeg-*" | head -1)
cp -f "$WIN_DIR/bin/ffmpeg.exe" "$RES/win/ffmpeg.exe"
echo "  -> $RES/win/ffmpeg.exe"

echo "=== Linux (x64) ==="
curl -fsSL -o "$TMP/ffmpeg-linux.tar.xz" "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz"
tar -xJf "$TMP/ffmpeg-linux.tar.xz" -C "$TMP"
LINUX_DIR=$(find "$TMP" -maxdepth 1 -type d -name "ffmpeg-*" | head -1)
cp -f "$LINUX_DIR/bin/ffmpeg" "$RES/linux/ffmpeg"
chmod +x "$RES/linux/ffmpeg"
echo "  -> $RES/linux/ffmpeg"

echo "=== Fertig. Inhalt: ==="
ls -la "$RES/mac/" "$RES/win/" "$RES/linux/"
