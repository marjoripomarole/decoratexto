import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  // Falls back to placeholder values at build time (no env vars) — auth
  // features will simply show "not logged in" until real keys are added.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder"
  )
}
