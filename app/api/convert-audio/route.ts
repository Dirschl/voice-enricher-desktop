import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);

// Check if FFmpeg is available (cross-platform)
async function findFFmpeg(): Promise<string | null> {
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

export async function POST(req: NextRequest) {
  const inputPath = join(tmpdir(), `input-${Date.now()}.webm`);
  const outputPath = join(tmpdir(), `output-${Date.now()}.pcm`);
  
  try {
    // Parse JSON body with base64 audio
    const body = await req.json().catch(() => null);
    
    if (!body?.audio) {
      return NextResponse.json({ error: "No audio data provided" }, { status: 400 });
    }
    
    // Decode base64 audio
    const audioBuffer = Buffer.from(body.audio, "base64");
    console.log("Convert-audio: Received audio, size:", audioBuffer.length);
    
    if (audioBuffer.length < 100) {
      return NextResponse.json({ error: "Audio data too small" }, { status: 400 });
    }
    
    // Find FFmpeg
    const ffmpegPath = await findFFmpeg();
    if (!ffmpegPath) {
      console.error("Convert-audio: FFmpeg not found");
      const installHint = process.platform === "win32"
        ? "FFmpeg nicht gefunden. Bitte installieren: winget install ffmpeg oder https://ffmpeg.org/download.html"
        : "FFmpeg nicht gefunden. Bitte installieren: brew install ffmpeg";
      return NextResponse.json({ error: installHint }, { status: 500 });
    }
    
    // Write input file
    await writeFile(inputPath, audioBuffer);
    
    // Convert to raw PCM float32 at 16kHz mono using ffmpeg
    const ffmpegCmd = `"${ffmpegPath}" -y -i "${inputPath}" -f f32le -ar 16000 -ac 1 "${outputPath}" 2>&1`;
    
    console.log("Convert-audio: Running ffmpeg from:", ffmpegPath);
    
    try {
      await execAsync(ffmpegCmd, { timeout: 30000 });
    } catch (ffmpegError) {
      console.error("Convert-audio: FFmpeg error:", ffmpegError);
      // Cleanup
      await unlink(inputPath).catch(() => {});
      return NextResponse.json({ 
        error: "FFmpeg Konvertierung fehlgeschlagen" 
      }, { status: 500 });
    }
    
    // Read the PCM output
    const pcmBuffer = await readFile(outputPath);
    console.log("Convert-audio: PCM output size:", pcmBuffer.length, "bytes");
    
    // Convert Buffer to Float32Array
    const cleanArrayBuffer = new ArrayBuffer(pcmBuffer.length);
    const uint8View = new Uint8Array(cleanArrayBuffer);
    uint8View.set(pcmBuffer);
    
    const float32Array = new Float32Array(cleanArrayBuffer);
    console.log("Convert-audio: Float32 samples:", float32Array.length, "duration:", (float32Array.length / 16000).toFixed(2), "s");
    
    // Return as base64 encoded binary
    const base64 = Buffer.from(cleanArrayBuffer).toString("base64");
    
    // Cleanup temp files
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    
    return NextResponse.json({ 
      samples: base64,
      sampleRate: 16000,
      length: float32Array.length,
    });
    
  } catch (error) {
    console.error("Convert-audio error:", error);
    
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    
    const message = error instanceof Error ? error.message : "Conversion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
