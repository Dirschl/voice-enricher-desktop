import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Sucht eine ausführbare FFmpeg-Binary (cross-platform).
 * @returns Pfad zur Binary oder null, wenn nicht gefunden.
 */
export async function findFFmpeg(): Promise<string | null> {
  const isWindows = process.platform === "win32";

  const paths = isWindows
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

  for (const ffmpegPath of paths) {
    try {
      await execAsync(`"${ffmpegPath}" -version`);
      return ffmpegPath;
    } catch {
      // Try next path
    }
  }
  return null;
}
