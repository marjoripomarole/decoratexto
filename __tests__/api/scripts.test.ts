import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// Mock the server Supabase client before importing the route
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}))

import { GET, POST, DELETE } from "@/app/api/scripts/route"
import { createClient } from "@/lib/supabase/server"

// ── Helpers ────────────────────────────────────────────────────────────────

function mockUnauthenticated() {
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  } as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)
}

function mockAuthenticated(user = { id: "user-123" }) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "script-1", title: "Test" }, error: null }),
    delete: vi.fn().mockReturnThis(),
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue(mockChain),
  } as ReturnType<typeof createClient> extends Promise<infer T> ? T : never)
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/scripts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated()
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it("returns 200 and an array when authenticated", async () => {
    mockAuthenticated()
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe("POST /api/scripts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated()
    const req = new NextRequest("http://localhost/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", parsed_script: {} }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 201 with saved script when authenticated", async () => {
    mockAuthenticated()
    const req = new NextRequest("http://localhost/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test", parsed_script: { lines: [] } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

describe("DELETE /api/scripts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockUnauthenticated()
    const req = new NextRequest("http://localhost/api/scripts?id=abc", {
      method: "DELETE",
    })
    const res = await DELETE(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when id is missing", async () => {
    mockAuthenticated()
    const req = new NextRequest("http://localhost/api/scripts", {
      method: "DELETE",
    })
    const res = await DELETE(req)
    expect(res.status).toBe(400)
  })
})
