/**
 * Integration tests — hit the real /api/health endpoint.
 *
 * Run against local dev server:
 *   TEST_URL=http://localhost:3000 npm run test:integration
 *
 * Run against production:
 *   TEST_URL=https://deixa.app npm run test:integration
 */

import { describe, it, expect } from "vitest"

const BASE_URL = process.env.TEST_URL

describe.skipIf(!BASE_URL)("Health check integration (requires TEST_URL)", () => {
  it("GET /api/health returns 200 with all services ok", async () => {
    const res = await fetch(`${BASE_URL}/api/health`)
    const data = await res.json() as { status: string; checks: Record<string, string>; timestamp: string }

    console.info("Health check result:", JSON.stringify(data, null, 2))

    expect(res.status).toBe(200)
    expect(data.status).toBe("ok")
    expect(data.checks.supabase).toBe("ok")
    expect(data.checks.azureSpeech).toBe("ok")
    expect(data.timestamp).toBeTruthy()
  })

  it("GET /api/scripts returns 401 for unauthenticated requests", async () => {
    const res = await fetch(`${BASE_URL}/api/scripts`)
    expect(res.status).toBe(401)
  })

  it("POST /api/tts returns 400 for missing params", async () => {
    const res = await fetch(`${BASE_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "", voiceId: "" }),
    })
    expect(res.status).toBe(400)
  })
})
