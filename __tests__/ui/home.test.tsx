/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import Home from "@/app/page"

const signInWithOAuth = vi.fn()
const signOut = vi.fn()
const unsubscribe = vi.fn()
const storage = new Map<string, string>()

const localStorageMock = {
  clear: vi.fn(() => storage.clear()),
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe } },
      })),
      signInWithOAuth,
      signOut,
    },
  })),
}))

describe("home upload screen", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storage.clear()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    })
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it("renders the first-page tool UI without marketing copy", async () => {
    render(<Home />)

    expect(screen.getByText("Deixa")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Ativar modo claro" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Carregar cena" })).toBeTruthy()
    expect(screen.getByText("Arraste o roteiro")).toBeTruthy()
    expect(screen.getByText("Selecionar arquivo")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Colar texto diretamente" })).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Entrar com Google" })).toBeTruthy()
    })

    expect(screen.queryByText("Para atores brasileiros")).toBeNull()
    expect(screen.queryByText("suas falas vivas.")).toBeNull()
    expect(screen.queryByText(/Um estúdio de ensaio/)).toBeNull()
  })

  it("switches between dark and light modes", async () => {
    render(<Home />)

    const lightButton = screen.getByRole("button", { name: "Ativar modo claro" })
    fireEvent.click(lightButton)

    expect(window.localStorage.getItem("deixa-color-mode")).toBe("light")
    expect(screen.getByRole("button", { name: "Ativar modo escuro" })).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo escuro" }))

    expect(window.localStorage.getItem("deixa-color-mode")).toBe("dark")
    expect(screen.getByRole("button", { name: "Ativar modo claro" })).toBeTruthy()
  })
})
