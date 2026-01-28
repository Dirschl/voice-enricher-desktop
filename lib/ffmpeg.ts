import { exec } from "child_process";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

/** Ordner-Name für die gebündelte FFmpeg-Binary (mac/win/linux, passend zu electron-builder ${os}). */
function getBundledOsFolder(): string {
  if (process.platform === "darwin") return "mac";
  if (process.platform === "win32") return "win";
  return "linux";
}

/**
 * Pfad zur mitgelieferten FFmpeg-Binary, falls vorhanden.
 * - Packaged (Electron): process.resourcesPath/ffmpeg/{mac|win|linux}/ffmpeg[.exe]
 * - Dev: process.cwd()/resources/ffmpeg/{mac|win|linux}/ffmpeg[.exe]
 */
function getBundledFFmpegPath(): string {
  // resourcesPath ist nur in Electron ( packaged ) gesetzt
  const resPath = typeof (process as unknown as { resourcesPath?: string }).resourcesPath === "string"
    ? (process as unknown as { resourcesPath: string }).resourcesPath
    : undefined;
  const base = resPath ? path.join(resPath, "ffmpeg") : path.join(process.cwd(), "resources", "ffmpeg");
  const osFolder = getBundledOsFolder();
  const bin = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  return path.join(base, osFolder, bin);
}

/**
 * Sucht eine ausführbare FFmpeg-Binary (cross-platform).
 * Bevorzugt die mitgelieferte Binary, danach System-Pfade.
 * @returns Pfad zur Binary oder null, wenn nicht gefunden.
 */
export async function findFFmpeg(): Promise<string | null> {
  const isWindows = process.platform === "win32";

  const systemPaths = isWindows
    ? [
        "ffmpeg",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe",
      ]
    : [
        "ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/opt/homebrew/bin/ffmpeg",
        "/usr/bin/ffmpeg",
      ];

  const toTry = [getBundledFFmpegPath(), ...systemPaths];

  for (const ffmpegPath of toTry) {
    try {
      await execAsync(`"${ffmpegPath}" -version`);
      return ffmpegPath;
    } catch {
      // Try next path
    }
  }
  return null;
}
