"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import type { ParsedScript, ScriptLine } from "@/types/script"
import { speak, stop } from "@/lib/tts"
import { VOICES } from "@/lib/voices"

function getPtBRVoiceNames(): string[] {
  if (typeof window === "undefined") return []
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang === "pt-BR" || v.lang === "pt_BR" || v.lang.startsWith("pt-BR"))
    .map((v) => v.name)
}

interface Props {
  script: ParsedScript
  playerCharacter: string
  onBack: () => void
}

function getPracticeLines(script: ParsedScript): ScriptLine[] {
  return script.lines.filter((l) => !l.isStageDirection && l.text.trim())
}

function assignVoices(characters: string[], playerCharacter: string): Record<string, string> {
  const others = characters.filter((c) => c !== playerCharacter)
  const map: Record<string, string> = {}
  others.forEach((char, i) => { map[char] = VOICES[i % VOICES.length].id })
  return map
}

export default function PracticeView({ script, playerCharacter, onBack }: Props) {
  const lines = getPracticeLines(script)
  const voiceMap = useMemo(() => assignVoices(script.characters, playerCharacter), [script.characters, playerCharacter])

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [autoPlay, setAutoPlay] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const current = lines[index]
  const isPlayerLine = current?.character === playerCharacter
  const progress = ((index + 1) / lines.length) * 100

  const playCurrentLine = useCallback(async () => {
    if (!current || isPlayerLine) return
    const voiceId = voiceMap[current.character] ?? VOICES[0].id
    setLoading(true); setSpeaking(true)
    await speak(current.text, voiceId, {
      rate: speechRate,
      onEnd: () => { setSpeaking(false); setLoading(false) },
      onError: () => { setSpeaking(false); setLoading(false) },
    })
    setLoading(false)
  }, [current, isPlayerLine, voiceMap, speechRate])

  useEffect(() => {
    setRevealed(false)
    if (autoPlay && current && !isPlayerLine) {
      const t = setTimeout(() => playCurrentLine(), 300)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, autoPlay])

  function next() {
    stop(); setSpeaking(false); setLoading(false); setRevealed(false)
    setIndex((i) => Math.min(i + 1, lines.length - 1))
  }
  function prev() {
    stop(); setSpeaking(false); setLoading(false); setRevealed(false)
    setIndex((i) => Math.max(i - 1, 0))
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") next()
      if (e.key === "ArrowLeft") prev()
      if (e.key === " ") { e.preventDefault(); isPlayerLine ? setRevealed((r) => !r) : playCurrentLine() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  if (!current) return null

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5">

      {/* Gold progress bar */}
      <div className="h-0.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => { stop(); onBack() }}
          className="text-xs text-cream/30 hover:text-cream/70 transition-colors tracking-wide"
        >
          ← Voltar
        </button>
        <span className="font-mono text-xs text-cream/20">{index + 1} / {lines.length}</span>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="text-xs text-cream/30 hover:text-cream/70 transition-colors"
        >
          ⚙ Ajustes
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-2xl border border-white/8 bg-white/4 p-5 space-y-4 text-sm">
          <label className="flex items-center justify-between">
            <span className="text-cream/60 text-xs tracking-wide">Leitura automática</span>
            <button
              onClick={() => setAutoPlay((a) => !a)}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoPlay ? "bg-wine" : "bg-white/10"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-cream transition-transform shadow-sm ${autoPlay ? "translate-x-5" : ""}`} />
            </button>
          </label>
          <div className="flex items-center justify-between gap-4">
            <span className="text-cream/60 text-xs tracking-wide">Velocidade</span>
            <div className="flex items-center gap-3">
              <input type="range" min={0.5} max={1.5} step={0.1} value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="w-24 accent-[#C89B3C]" />
              <span className="text-cream/40 text-xs w-8 tabular-nums">{speechRate.toFixed(1)}×</span>
            </div>
          </div>
          {script.characters.filter(c => c !== playerCharacter).length > 0 && (
            <div className="pt-3 border-t border-white/5 space-y-2">
              <p className="text-[10px] tracking-widest text-cream/25 uppercase">Vozes atribuídas (pt-BR)</p>
              {script.characters.filter(c => c !== playerCharacter).map((char) => {
                const voiceNames = getPtBRVoiceNames()
                const idx = parseInt(voiceMap[char] ?? "0", 10)
                const name = voiceNames.length > 0
                  ? voiceNames[idx % voiceNames.length]
                  : "Voz do sistema (pt-BR)"
                return (
                  <div key={char} className="flex justify-between text-xs">
                    <span className="text-cream/60 font-semibold">{char}</span>
                    <span className="text-cream/30">{name}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Character badge */}
      <div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full border
          ${isPlayerLine
            ? "border-wine/40 bg-wine/15 text-wine"
            : "border-white/10 bg-white/5 text-cream/40"
          }`}>
          {isPlayerLine && <span className="w-1 h-1 rounded-full bg-wine inline-block" />}
          {current.character}
          {isPlayerLine && " — você"}
        </span>
      </div>

      {/* Line card */}
      <div className={`rounded-2xl border-2 p-8 md:p-10 min-h-[220px] flex flex-col justify-center gap-6 transition-colors
        ${isPlayerLine
          ? "border-wine/25 bg-wine/8"
          : "border-white/8 bg-white/3"
        }`}>

        {isPlayerLine ? (
          <>
            {revealed ? (
              <p className="font-display text-2xl md:text-3xl leading-relaxed font-medium text-cream">
                {current.text}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 items-end">
                {current.text.split(" ").map((w, i) => (
                  <span
                    key={i}
                    className="inline-block rounded-md h-6 bg-wine/25"
                    style={{ width: `${Math.max(28, w.length * 10)}px` }}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => setRevealed((r) => !r)}
              className="self-start text-xs font-semibold tracking-wide text-wine/70 hover:text-wine border border-wine/20 hover:border-wine/50 rounded-lg px-4 py-2 transition-all"
            >
              {revealed ? "Ocultar fala" : "Revelar fala"}
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-2xl md:text-3xl leading-relaxed text-cream/80">
              {current.text}
            </p>
            <button
              onClick={playCurrentLine}
              disabled={speaking || loading}
              className="self-start flex items-center gap-2 text-xs font-semibold tracking-wide text-cream/40 hover:text-gold border border-white/10 hover:border-gold/30 rounded-lg px-4 py-2 transition-all disabled:opacity-30"
            >
              {loading
                ? <><span className="animate-spin inline-block text-sm">⏳</span> Carregando...</>
                : speaking
                ? <><span className="animate-pulse text-sm">🔊</span> Reproduzindo...</>
                : <>🔊 Ouvir novamente</>
              }
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          onClick={prev}
          disabled={index === 0}
          className="flex-1 rounded-xl border border-white/10 py-3.5 text-sm font-medium text-cream/50 hover:bg-white/5 hover:text-cream/80 disabled:opacity-20 transition-all"
        >
          ← Anterior
        </button>
        {index === lines.length - 1 ? (
          <button
            onClick={() => { setIndex(0); setRevealed(false) }}
            className="flex-1 rounded-xl bg-gold/90 hover:bg-gold py-3.5 text-sm font-bold text-charcoal transition-colors"
          >
            Reiniciar 🎉
          </button>
        ) : (
          <button
            onClick={next}
            className="flex-1 rounded-xl bg-wine hover:bg-wine-dark py-3.5 text-sm font-bold text-cream transition-colors"
          >
            Próxima →
          </button>
        )}
      </div>

      <p className="text-center text-[10px] tracking-widest text-cream/15 uppercase">
        ← → navegar &nbsp;•&nbsp; Espaço: revelar / ouvir
      </p>
    </div>
  )
}
