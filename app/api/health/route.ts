import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const checks: Record<string, string> = {}

  // ── Supabase ──────────────────────────────────────────────────────────────
  try {
    const supabase = await createClient()
    // A lightweight query — just asks Postgres if the scripts table exists.
    const { error } = await supabase.from("scripts").select("id").limit(1)
    checks.supabase = error ? `error: ${error.message}` : "ok"
  } catch (e) {
    checks.supabase = `error: ${String(e)}`
  }

  // ── ElevenLabs ───────────────────────────────────────────────────────────
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey === "placeholder") {
    checks.elevenlabs = "error: API key not configured"
  } else {
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": apiKey },
      })
      checks.elevenlabs = res.ok ? "ok" : `error: HTTP ${res.status}`
    } catch (e) {
      checks.elevenlabs = `error: ${String(e)}`
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok")

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}
