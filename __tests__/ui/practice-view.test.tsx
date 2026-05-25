/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import PracticeView, { getCueText } from "@/components/PracticeView"
import type { ParsedScript } from "@/types/script"

const mocks = vi.hoisted(() => ({
  speak: vi.fn(),
  stop: vi.fn(),
  preloadLines: vi.fn(),
  clearCache: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock("@/lib/tts", () => ({
  speak: mocks.speak,
  stop: mocks.stop,
}))

vi.mock("@/lib/audioCache", () => ({
  preloadLines: mocks.preloadLines,
  clearCache: mocks.clearCache,
  onStatus: vi.fn(() => mocks.unsubscribe),
}))

const script: ParsedScript = {
  title: "Cena teste",
  characters: ["ANA", "BRUNO"],
  lines: [
    {
      id: "1",
      character: "BRUNO",
      text: "Eu pensei em tudo, mas agora você precisa entrar.",
      isStageDirection: false,
    },
    {
      id: "2",
      character: "ANA",
      text: "Eu entro agora.",
      isStageDirection: false,
    },
  ],
}

describe("practice view cue mode", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.speak.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  it("keeps only the final cue words from a line", () => {
    expect(getCueText("Primeira frase. Eu pensei em tudo, mas agora você precisa entrar.")).toBe("mas agora você precisa entrar.")
    expect(getCueText("Respira e vai.")).toBe("Respira e vai.")
    expect(getCueText("   ")).toBe("")
  })

  it("switches the visible line and TTS playback to cue-only mode", async () => {
    render(<PracticeView script={script} playerCharacter="ANA" onBack={vi.fn()} />)

    await waitFor(() => {
      expect(mocks.preloadLines).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "1",
          text: "Eu pensei em tudo, mas agora você precisa entrar.",
        }),
      ])
    })

    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }))
    fireEvent.click(screen.getByRole("button", { name: "Desativar leitura automática" }))
    vi.clearAllMocks()

    fireEvent.click(screen.getByRole("button", { name: "Ativar modo só deixa" }))

    expect(screen.queryByText("Eu pensei em tudo, mas agora você precisa entrar.")).toBeNull()
    expect(screen.getByText("mas agora você precisa entrar.")).toBeTruthy()

    await waitFor(() => {
      expect(mocks.preloadLines).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "1:cue",
          text: "mas agora você precisa entrar.",
        }),
      ])
    })

    fireEvent.click(screen.getByRole("button", { name: "Ouvir novamente" }))

    await waitFor(() => {
      expect(mocks.speak).toHaveBeenCalledWith(
        "mas agora você precisa entrar.",
        expect.any(String),
        expect.objectContaining({ rate: 1 }),
        "1:cue",
      )
    })
  })
})
