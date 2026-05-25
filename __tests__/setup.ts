import { vi } from "vitest"

// next/headers is only available in the Next.js runtime — mock it so
// server-side Supabase clients can be imported in unit tests.
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
    get: vi.fn(() => null),
  })),
}))
