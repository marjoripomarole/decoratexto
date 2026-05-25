import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    // API route tests run in Node (no DOM needed)
    environment: "node",
    setupFiles: ["__tests__/setup.ts"],
    // Load real keys from .env.local for integration tests
    env: {
      NEXT_PUBLIC_SUPABASE_URL:
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder",
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? "placeholder",
    },
  },
})
