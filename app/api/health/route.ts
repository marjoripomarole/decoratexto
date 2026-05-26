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

  // ── Azure Speech ─────────────────────────────────────────────────────────
  const speechKey = process.env.AZURE_SPEECH_KEY ?? process.env.SPEECH_KEY
  const speechRegion = process.env.AZURE_SPEECH_REGION ?? process.env.SPEECH_REGION

  if (!speechKey || speechKey === "placeholder" || !speechRegion || speechRegion === "placeholder") {
    checks.azureSpeech = "error: API key or region not configured"
  } else {
    try {
      const res = await fetch(`https://${speechRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
        headers: { "Ocp-Apim-Subscription-Key": speechKey },
      })
      checks.azureSpeech = res.ok ? "ok" : `error: HTTP ${res.status}`
    } catch (e) {
      checks.azureSpeech = `error: ${String(e)}`
    }
  }

  const allOk = Object.values(checks).every((v) => v === "ok")

  return NextResponse.json(
    { status: allOk ? "ok" : "degraded", checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  )
}
