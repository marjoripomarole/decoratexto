"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import type { ParsedScript, ScriptLine } from "@/types/script"
import { speak, stop } from "@/lib/tts"

interface Props {
  script: ParsedScript
  playerCharacter: string
  onBack: () => void
}

// Only lines with actual dialogue (no stage directions, no empty)
function getPracticeLines(script: ParsedScript): ScriptLine[] {
  return script.lines.filter((l) => !l.isStageDirection && l.text.trim())
}

export default function PracticeView({ script, playerCharacter, onBack }: Props) {
  const lines = getPracticeLines(script)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [autoPlay, setAutoPlay] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const current = lines[index]
  const isPlayerLine = current?.character === playerCharacter
  const progress = ((index + 1) / lines.length) * 100

  const playCurrentLine = useCallback(() => {
    if (!current || isPlayerLine) return
    setSpeaking(true)
    speak(current.text, speechRate, () => setSpeaking(false))
  }, [current, isPlayerLine, speechRate])

  // Auto-play TTS when moving to another character's line
  useEffect(() => {
    setRevealed(false)
    if (autoPlay && current && !isPlayerLine) {
      // Small delay so state settles
      const t = setTimeout(() => playCurrentLine(), 300)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, autoPlay])

  // Skip to the next line that needs practice (player's lines) or stop at cues
  function next() {
    stop()
    setSpeaking(false)
    setRevealed(false)
    setIndex((i) => Math.min(i + 1, lines.length - 1))
  }

  function prev() {
    stop()
    setSpeaking(false)
    setRevealed(false)
    setIndex((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") next()
      if (e.key === "ArrowLeft") prev()
      if (e.key === " ") {
        e.preventDefault()
        if (isPlayerLine) setRevealed((r) => !r)
        else playCurrentLine()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!current) return null

  const done = index === lines.length - 1 && revealed

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { stop(); onBack() }}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ← Voltar
        </button>
        <span className="text-xs text-zinc-400 font-mono">
          {index + 1} / {lines.length}
        </span>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          ⚙️ Ajustes
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-zinc-200">
        <div
          className="h-1.5 rounded-full bg-amber-400 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3 text-sm">
          <label className="flex items-center justify-between">
            <span className="text-zinc-600">Leitura automática</span>
            <button
              onClick={() => setAutoPlay((a) => !a)}
              className={`w-10 h-6 rounded-full transition-colors ${autoPlay ? "bg-amber-400" : "bg-zinc-300"}`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white mx-1 transition-transform ${autoPlay ? "translate-x-4" : ""}`} />
            </button>
          </label>
          <label className="flex items-center justify-between gap-4">
            <span className="text-zinc-600">Velocidade da voz</span>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.5}
                max={1.5}
                step={0.1}
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="w-24 accent-amber-500"
              />
              <span className="text-zinc-500 w-8">{speechRate.toFixed(1)}x</span>
            </div>
          </label>
        </div>
      )}

      {/* Character label */}
      <div className={`text-xs font-bold tracking-widest uppercase px-3 py-1 rounded-full w-fit
        ${isPlayerLine ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-500"}`}>
        {current.character}
        {isPlayerLine && " (você)"}
      </div>

      {/* Line card */}
      <div
        ref={cardRef}
        className={`rounded-2xl border-2 p-8 min-h-[180px] flex flex-col justify-center gap-4 transition-all
          ${isPlayerLine ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-white"}`}
      >
        {isPlayerLine ? (
          <>
            {revealed ? (
              <p className="text-xl leading-relaxed text-zinc-800 font-medium">{current.text}</p>
            ) : (
              <div className="space-y-2">
                {current.text.split(" ").map((_, i) => (
                  <span key={i} className="inline-block bg-amber-300 rounded h-5 mr-1" style={{ width: `${40 + (i % 4) * 20}px` }} />
                ))}
              </div>
            )}
            <button
              onClick={() => setRevealed((r) => !r)}
              className="self-start text-sm font-semibold text-amber-700 hover:text-amber-900 underline transition-colors"
            >
              {revealed ? "Ocultar fala" : "Revelar fala"}
            </button>
          </>
        ) : (
          <>
            <p className="text-xl leading-relaxed text-zinc-700">{current.text}</p>
            <button
              onClick={playCurrentLine}
              disabled={speaking}
              className="self-start flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-colors disabled:opacity-40"
            >
              {speaking ? (
                <>
                  <span className="animate-pulse">🔊</span> Reproduzindo...
                </>
              ) : (
                <>🔊 Ouvir novamente</>
              )}
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={prev}
          disabled={index === 0}
          className="flex-1 rounded-xl border border-zinc-300 py-3 font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 transition-colors"
        >
          ← Anterior
        </button>
        {done ? (
          <button
            onClick={() => { setIndex(0); setRevealed(false) }}
            className="flex-1 rounded-xl bg-emerald-500 py-3 font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            Reiniciar 🎉
          </button>
        ) : (
          <button
            onClick={next}
            disabled={index === lines.length - 1}
            className="flex-1 rounded-xl bg-amber-500 py-3 font-semibold text-white hover:bg-amber-600 disabled:opacity-30 transition-colors"
          >
            Próxima →
          </button>
        )}
      </div>

      {/* Keyboard hints */}
      <p className="text-center text-xs text-zinc-400">
        ← → navegar • Espaço: revelar / ouvir
      </p>
    </div>
  )
}
