import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Provider = "ollama" | "gemini" | "openai" | "openrouter";
type Mode = "note" | "meeting" | "email" | "tasks" | "custom";
type OutputFormat = "markdown" | "html" | "text" | "plain";

function buildSystemPrompt(customPrompt: string): string {
  // The prompt itself defines the desired output format
  return customPrompt;
}

async function enrichWithOllama(args: {
  baseUrl: string;
  model: string;
  transcript: string;
  systemPrompt: string;
}) {
  const { baseUrl, model, transcript, systemPrompt } = args;
  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TRANSKRIPT:\n${transcript}` },
      ],
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Ollama error: ${errorText}`);
  }
  const data = await res.json();
  const content = data?.message?.content ?? "";
  return content;
}

async function enrichWithGemini(args: {
  apiKey: string;
  model: string;
  transcript: string;
  systemPrompt: string;
}) {
  const { apiKey, model, transcript, systemPrompt } = args;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\nTRANSKRIPT:\n${transcript}` }],
          },
        ],
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini error: ${await res.text()}`);
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text).filter(Boolean).join("\n") || "";
  return text;
}

async function enrichWithOpenAI(args: { apiKey: string; model: string; transcript: string; systemPrompt: string }) {
  const { apiKey, model, transcript, systemPrompt } = args;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TRANSKRIPT:\n${transcript}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content ?? "";
  return out;
}

async function enrichWithOpenRouter(args: { apiKey: string; model: string; transcript: string; systemPrompt: string }) {
  const { apiKey, model, transcript, systemPrompt } = args;
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `TRANSKRIPT:\n${transcript}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter error: ${await res.text()}`);
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content ?? "";
  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as
    | {
        provider?: Provider;
        model?: string;
        apiKey?: string;
        transcript?: string;
        mode?: Mode;
        ollamaBaseUrl?: string;
        outputFormat?: OutputFormat;
        customPrompt?: string;
      }
    | null;

  if (!body?.transcript) return new NextResponse("Missing transcript", { status: 400 });

  const provider = (body.provider || "ollama") as Provider;
  const format = (body.outputFormat || "markdown") as OutputFormat;
  const model = body.model?.trim() || (provider === "gemini" ? "gemini-1.5-flash" : "llama3.2:3b");
  
  // Use provided custom prompt or fallback to default note prompt
  const basePrompt = body.customPrompt || `Mache aus dem Transkript eine strukturierte Notiz.`;
  const systemPrompt = buildSystemPrompt(basePrompt);
  
  console.log("API enrich - received customPrompt:", body.customPrompt);
  console.log("API enrich - systemPrompt:", systemPrompt);

  try {
    let result = "";
    if (provider === "ollama") {
      const baseUrl = body.ollamaBaseUrl?.trim() || "http://127.0.0.1:11434";
      result = await enrichWithOllama({ baseUrl, model, transcript: body.transcript, systemPrompt });
    } else if (provider === "gemini") {
      if (!body.apiKey?.trim()) return new NextResponse("Missing Gemini apiKey", { status: 400 });
      result = await enrichWithGemini({ apiKey: body.apiKey.trim(), model, transcript: body.transcript, systemPrompt });
    } else if (provider === "openai") {
      if (!body.apiKey?.trim()) return new NextResponse("Missing OpenAI apiKey", { status: 400 });
      result = await enrichWithOpenAI({ apiKey: body.apiKey.trim(), model, transcript: body.transcript, systemPrompt });
    } else if (provider === "openrouter") {
      if (!body.apiKey?.trim()) return new NextResponse("Missing OpenRouter apiKey", { status: 400 });
      result = await enrichWithOpenRouter({ apiKey: body.apiKey.trim(), model, transcript: body.transcript, systemPrompt });
    } else {
      return new NextResponse("Unsupported provider", { status: 400 });
    }

    return NextResponse.json({ result, format });
  } catch (e: unknown) {
    const err = e instanceof Error ? e : new Error(String(e));
    console.error("API enrich - error:", err.message, err.cause || "");
    if (err.stack) console.error("API enrich - stack:", err.stack);
    // Hilfreiche Meldung bei typischen Fehlern
    let message = err.message;
    if (typeof message === "string" && (message.includes("ECONNREFUSED") || message.includes("fetch failed") || message.toLowerCase().includes("network"))) {
      message = "Ollama nicht erreichbar. Bitte starte Ollama (z.B. im Terminal: ollama serve) und prüfe die Einstellungen (Ollama-URL, Modell).";
    }
    if (typeof message === "string" && message.startsWith("Ollama error:") && message.includes("404")) {
      message = "Modell nicht gefunden. In Einstellungen ein installiertes Modell wählen (z.B. ollama pull llama3.2:3b).";
    }
    return new NextResponse(message, { status: 500 });
  }
}
