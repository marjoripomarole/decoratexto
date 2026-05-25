import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"
import { POST } from "@/app/api/tts/route"

describe("POST /api/tts", () => {
  beforeEach(() => vi.clearAllMocks())

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

  it("returns 500 when ELEVENLABS_API_KEY is not set", async () => {
    const original = process.env.ELEVENLABS_API_KEY
    delete process.env.ELEVENLABS_API_KEY

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá", voiceId: "some-voice" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)

    process.env.ELEVENLABS_API_KEY = original
  })

  it("calls ElevenLabs and streams audio when params are valid", async () => {
    // Mock global fetch to simulate a successful ElevenLabs response
    const mockAudio = new Uint8Array([0, 1, 2, 3])
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(mockAudio)
            controller.close()
          },
        }),
      })
    )

    const req = new NextRequest("http://localhost/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá mundo", voiceId: "EXAVITQu4vr4xnSDxMaL" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg")

    vi.unstubAllGlobals()
  })
})
