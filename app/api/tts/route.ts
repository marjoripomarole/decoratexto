import { NextRequest, NextResponse } from "next/server"

const DEFAULT_OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
const DEFAULT_VOICE = "pt-BR-FranciscaNeural"

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
      body: createSsml(text, voiceId),
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

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  })
}
