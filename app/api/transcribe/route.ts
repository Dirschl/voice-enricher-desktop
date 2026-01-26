import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const apiKey = formData.get("apiKey") as string;
    const language = (formData.get("language") as string) || "de";
    
    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }
    
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI API Key erforderlich für Whisper API" }, { status: 400 });
    }
    
    console.log("Transcribe API: Received audio file, size:", audioFile.size, "type:", audioFile.type);
    
    // Send to OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, "audio.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", language);
    whisperFormData.append("response_format", "json");
    
    console.log("Transcribe API: Sending to OpenAI Whisper...");
    
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Transcribe API: OpenAI error:", errorText);
      return NextResponse.json({ 
        error: `OpenAI Fehler: ${response.status} - ${errorText}` 
      }, { status: response.status });
    }
    
    const result = await response.json();
    console.log("Transcribe API: Success, transcript length:", result.text?.length);
    
    return NextResponse.json({ 
      transcript: result.text || "",
    });
    
  } catch (error) {
    console.error("Transcribe API error:", error);
    const message = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
