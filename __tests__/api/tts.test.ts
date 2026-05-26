import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/tts/route"

const supabaseMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
  upsert: vi.fn(),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: supabaseMocks.createClient,
}))

describe("POST /api/tts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.AZURE_SPEECH_KEY = "test-key"
    process.env.AZURE_SPEECH_REGION = "brazilsouth"
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co"
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SPEECH_KEY
    delete process.env.SPEECH_REGION
    delete process.env.TTS_AUDIO_BUCKET

    supabaseMocks.createClient.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: supabaseMocks.download,
          upload: supabaseMocks.upload,
        })),
      },
      from: vi.fn(() => ({
        upsert: supabaseMocks.upsert,
      })),
    })
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
      arrayBuffer: vi.fn().mockResolvedValue(mockAudio.buffer),
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
    expect(res.headers.get("X-TTS-Cache")).toBe("skip")
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

  it("returns cached audio from Supabase Storage before calling Azure", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    supabaseMocks.download.mockResolvedValue({
      data: new Blob([new Uint8Array([9, 8, 7])], { type: "audio/mpeg" }),
      error: null,
    })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá mundo", voiceId: "pt-BR-FranciscaNeural" }),
    })
    const res = await POST(req)
    const audio = new Uint8Array(await res.arrayBuffer())

    expect(res.status).toBe(200)
    expect(res.headers.get("X-TTS-Cache")).toBe("hit")
    expect(Array.from(audio)).toEqual([9, 8, 7])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("stores generated audio in Supabase Storage on a cache miss", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role"
    supabaseMocks.download.mockResolvedValue({ data: null, error: { message: "not found" } })
    supabaseMocks.upload.mockResolvedValue({ data: {}, error: null })
    supabaseMocks.upsert.mockResolvedValue({ data: {}, error: null })

    const mockAudio = new Uint8Array([4, 5, 6])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(mockAudio.buffer),
    })
    vi.stubGlobal("fetch", fetchMock)

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá mundo", voiceId: "pt-BR-FranciscaNeural" }),
    })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(res.headers.get("X-TTS-Cache")).toBe("miss")
    expect(supabaseMocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^azure\/pt-BR-FranciscaNeural\/audio-24khz-48kbitrate-mono-mp3\/[a-f0-9]+\.mp3$/),
      expect.any(Blob),
      expect.objectContaining({
        contentType: "audio/mpeg",
        upsert: true,
      })
    )
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "azure",
        voice_id: "pt-BR-FranciscaNeural",
        content_type: "audio/mpeg",
        output_format: "audio-24khz-48kbitrate-mono-mp3",
      }),
      { onConflict: "cache_key" }
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
