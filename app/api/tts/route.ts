import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
const DEFAULT_VOICE = "pt-BR-FranciscaNeural"
const DEFAULT_CACHE_BUCKET = "tts-audio"
const PROVIDER = "azure"

type AzureSpeechError = {
  error?: {
    code?: string
    message?: string
  }
  code?: string
  message?: string
}

function getAzureConfig() {
  const key = process.env.AZURE_SPEECH_KEY ?? process.env.SPEECH_KEY
  const region = process.env.AZURE_SPEECH_REGION ?? process.env.SPEECH_REGION
  const outputFormat = process.env.AZURE_SPEECH_OUTPUT_FORMAT ?? DEFAULT_OUTPUT_FORMAT

  if (!key || key === "placeholder" || !region || region === "placeholder") {
    return null
  }

  return { key, outputFormat, region }
}

function getCacheClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey || serviceRoleKey === "placeholder") {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, " ")
}

function getTextHash(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

function getCachePath(text: string, voiceId: string, outputFormat: string): { hash: string; path: string } {
  const normalizedText = normalizeText(text)
  const hash = getTextHash(`${PROVIDER}:${voiceId}:${outputFormat}:${normalizedText}`)

  return {
    hash,
    path: `${PROVIDER}/${voiceId}/${outputFormat}/${hash}.mp3`,
  }
}

function audioResponse(audio: BodyInit, cacheStatus: "hit" | "miss" | "skip"): NextResponse {
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-TTS-Cache": cacheStatus,
    },
  })
}

async function readCachedAudio(path: string): Promise<ArrayBuffer | null> {
  const supabase = getCacheClient()
  if (!supabase) return null

  const bucket = process.env.TTS_AUDIO_BUCKET ?? DEFAULT_CACHE_BUCKET
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data) return null

  return data.arrayBuffer()
}

async function writeCachedAudio(params: {
  audio: ArrayBuffer
  hash: string
  outputFormat: string
  path: string
  voiceId: string
}) {
  const supabase = getCacheClient()
  if (!supabase) return

  const bucket = process.env.TTS_AUDIO_BUCKET ?? DEFAULT_CACHE_BUCKET
  const blob = new Blob([params.audio], { type: "audio/mpeg" })

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(params.path, blob, {
      cacheControl: "31536000",
      contentType: "audio/mpeg",
      upsert: true,
    })

  if (uploadError) {
    console.error("TTS cache upload error:", uploadError)
    return
  }

  const { error: metadataError } = await supabase
    .from("tts_audio_cache")
    .upsert({
      cache_key: params.path,
      provider: PROVIDER,
      voice_id: params.voiceId,
      text_hash: params.hash,
      storage_path: params.path,
      content_type: "audio/mpeg",
      byte_size: params.audio.byteLength,
      output_format: params.outputFormat,
    }, { onConflict: "cache_key" })

  if (metadataError) {
    console.error("TTS cache metadata error:", metadataError)
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function createSsml(text: string, voiceId: string): string {
  const voice = voiceId.trim() || DEFAULT_VOICE

  return [
    "<speak version='1.0' xml:lang='pt-BR'>",
    `<voice xml:lang='pt-BR' name='${escapeXml(voice)}'>`,
    escapeXml(text),
    "</voice>",
    "</speak>",
  ].join("")
}

async function getAzureError(response: Response): Promise<{ code: string; message: string }> {
  const fallback = { code: `http_${response.status}`, message: "Não foi possível gerar a voz agora." }

  try {
    const contentType = response.headers.get("Content-Type") ?? ""
    if (contentType.includes("application/json")) {
      const data = await response.json() as AzureSpeechError
      return {
        code: data.error?.code ?? data.code ?? fallback.code,
        message: data.error?.message ?? data.message ?? fallback.message,
      }
    }

    const message = await response.text()
    return { code: fallback.code, message: message || fallback.message }
  } catch {
    return fallback
  }
}

function getClientErrorMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "Chave ou região do Azure Speech inválida. Verifique a configuração da API."
  }

  if (status === 429) {
    return "Cota do Azure Speech atingida. Aguarde a renovação do limite gratuito ou ajuste o plano."
  }

  return "Não foi possível gerar a voz agora."
}

export async function POST(req: NextRequest) {
  const config = getAzureConfig()
  if (!config) {
    return NextResponse.json({ error: "Azure Speech não configurado" }, { status: 500 })
  }

  const { text, voiceId } = await req.json() as { text: string; voiceId: string }

  if (!text?.trim() || !voiceId) {
    return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  }

  const normalizedText = normalizeText(text)
  const { hash, path } = getCachePath(normalizedText, voiceId, config.outputFormat)
  const cachedAudio = await readCachedAudio(path)

  if (cachedAudio) {
    return audioResponse(cachedAudio, "hit")
  }

  const response = await fetch(
    `https://${config.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": config.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": config.outputFormat,
        "User-Agent": "deixa",
      },
      body: createSsml(normalizedText, voiceId),
    }
  )

  if (!response.ok) {
    const err = await getAzureError(response)
    console.error("Azure Speech error:", err)
    return NextResponse.json(
      { error: getClientErrorMessage(response.status), code: err.code },
      { status: response.status === 429 ? 429 : 502 }
    )
  }

  const audio = await response.arrayBuffer()
  await writeCachedAudio({
    audio,
    hash,
    outputFormat: config.outputFormat,
    path,
    voiceId,
  })

  return audioResponse(audio, getCacheClient() ? "miss" : "skip")
}
