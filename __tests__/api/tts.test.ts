import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/tts/route"

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AZURE_SPEECH_KEY = "test-key"
    process.env.AZURE_SPEECH_REGION = "brazilsouth"
    delete process.env.SPEECH_KEY
    delete process.env.SPEECH_REGION
  })
  afterEach(() => vi.unstubAllGlobals())

  it("returns 400 when text is empty", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "   ", voiceId: "some-voice" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 400 when voiceId is missing", async () => {
    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá", voiceId: "" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("returns 500 when Azure Speech is not configured", async () => {
    delete process.env.AZURE_SPEECH_KEY
    delete process.env.AZURE_SPEECH_REGION

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá", voiceId: "some-voice" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
  })

  it("calls Azure Speech and streams audio when params are valid", async () => {
    const mockAudio = new Uint8Array([0, 1, 2, 3])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(mockAudio)
          controller.close()
        },
      }),
    })

    vi.stubGlobal(
      "fetch",
      fetchMock
    )

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá mundo", voiceId: "pt-BR-FranciscaNeural" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg")
    expect(fetchMock).toHaveBeenCalledWith(
      "https://brazilsouth.tts.speech.microsoft.com/cognitiveservices/v1",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Ocp-Apim-Subscription-Key": "test-key",
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
        }),
        body: expect.stringContaining("pt-BR-FranciscaNeural"),
      })
    )
  })

  it("returns a specific client error when Azure Speech quota is exhausted", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "Content-Type": "application/json" }),
        json: vi.fn().mockResolvedValue({
          error: {
            code: "TooManyRequests",
            message: "Quota exceeded.",
          },
        }),
      })
    )

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá mundo", voiceId: "pt-BR-FranciscaNeural" }),
    })
    const res = await POST(req)
    const data = await res.json() as { error: string; code: string }

    expect(res.status).toBe(429)
    expect(data.code).toBe("TooManyRequests")
    expect(data.error).toBe("Cota do Azure Speech atingida. Aguarde a renovação do limite gratuito ou ajuste o plano.")
  })
})
