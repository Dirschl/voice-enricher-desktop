# GitHub Setup Anleitung

## Schritt 1: Git Repository initialisieren

```bash
cd /Users/Dirschl/Sites/voice-enricher-desktop
git init
```

## Schritt 2: Alle Dateien hinzufügen

```bash
git add .
```

## Schritt 3: Erster Commit

```bash
git commit -m "Initial commit: Voice Enricher Desktop App"
```

## Schritt 4: GitHub Repository erstellen

1. Gehe zu [GitHub.com](https://github.com) und logge dich ein
2. Klicke auf das **"+"** Symbol oben rechts → **"New repository"**
3. Repository-Name: z.B. `voice-enricher-desktop`
4. Beschreibung: "Sprache zu strukturierten Texten – lokal, privat und flexibel"
5. **WICHTIG**: Wähle **"Public"** (für öffentliches Teilen) oder **"Private"** (nur für dich)
6. **NICHT** "Initialize this repository with a README" ankreuzen (wir haben schon eine)
7. Klicke auf **"Create repository"**

## Schritt 5: Repository mit GitHub verbinden

GitHub zeigt dir nach dem Erstellen Befehle an. Verwende diese:

```bash
# Ersetze USERNAME mit deinem GitHub-Benutzernamen
# Ersetze REPO-NAME mit dem Namen deines Repositories

git remote add origin https://github.com/USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main
```

**Beispiel:**
```bash
git remote add origin https://github.com/jdirschl/voice-enricher-desktop.git
git branch -M main
git push -u origin main
```

## Schritt 6: Link zum Teilen

Nach dem Hochladen ist dein Projekt unter folgendem Link erreichbar:

```
https://github.com/USERNAME/REPO-NAME
```

**Beispiel:**
```
https://github.com/jdirschl/voice-enricher-desktop
```

## Weitere Schritte (Optional)

### Releases erstellen

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf **"Releases"** → **"Create a new release"**
3. Tag: `v1.0.0`
4. Titel: `Voice Enricher Desktop v1.0.0`
5. Beschreibung: Features auflisten
6. Lade das DMG als Asset hoch (optional)
7. Klicke auf **"Publish release"**

### GitHub Pages (für Dokumentation)

Falls du die README als Website anzeigen möchtest:
1. Repository → **Settings** → **Pages**
2. Source: `main` branch, `/ (root)`
3. Speichern
4. Nach ein paar Minuten: `https://USERNAME.github.io/REPO-NAME`

## Wichtige Hinweise

- **Sensible Daten**: Prüfe, dass keine API-Keys oder Passwörter in den Dateien sind
- **.gitignore**: Wurde bereits erstellt und enthält wichtige Ausschlüsse
- **README.md**: Ist bereits vorhanden und dokumentiert die App

## Hilfe

Falls du Probleme hast:
- GitHub Docs: https://docs.github.com
- Git Tutorial: https://git-scm.com/docs
