"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import type { ParsedScript, ScriptLine } from "@/types/script"
import { speak, stop } from "@/lib/tts"
import { VOICES } from "@/lib/voices"
import { preloadLines, clearCache, onStatus, type PreloadStatus } from "@/lib/audioCache"

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

export function getCueText(text: string, maxWords = 5): string {
  const normalized = text.trim().replace(/\s+/g, " ")
  if (!normalized) return ""

  const sentences = normalized.match(/[^.!?…]+[.!?…]*/g)
  const finalSentence = sentences?.at(-1)?.trim() || normalized
  const words = finalSentence.split(/\s+/)

  return words.length <= maxWords ? finalSentence : words.slice(-maxWords).join(" ")
}

function getAudioCacheId(lineId: string, cueMode: boolean): string {
  return cueMode ? `${lineId}:cue` : lineId
}

export default function PracticeView({ script, playerCharacter, onBack }: Props) {
  const lines = useMemo(() => getPracticeLines(script), [script])
  const voiceMap = useMemo(() => assignVoices(script.characters, playerCharacter), [script.characters, playerCharacter])

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [speechRate, setSpeechRate] = useState(1)
  const [autoPlay, setAutoPlay] = useState(true)
  const [cueMode, setCueMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preload, setPreload] = useState<PreloadStatus>({ total: 0, loaded: 0, done: true })

  const current = lines[index]
  const isPlayerLine = current?.character === playerCharacter
  const progress = ((index + 1) / lines.length) * 100

  useEffect(() => {
    const nonPlayerLines = lines.filter((l) => l.character !== playerCharacter)
    const items = nonPlayerLines.map((l) => ({
      id: getAudioCacheId(l.id, cueMode),
      text: cueMode ? getCueText(l.text) : l.text,
      voiceId: voiceMap[l.character] ?? VOICES[0].id,
    }))
    const unsub = onStatus(setPreload)
    preloadLines(items)
    return () => { unsub(); clearCache() }
  }, [cueMode, lines, playerCharacter, voiceMap])

  const playCurrentLine = useCallback(async () => {
    if (!current || isPlayerLine) return
    const voiceId = voiceMap[current.character] ?? VOICES[0].id
    const spokenText = cueMode ? getCueText(current.text) : current.text
    setLoading(true); setSpeaking(true)
    await speak(
      spokenText, voiceId,
      { rate: speechRate, onEnd: () => { setSpeaking(false); setLoading(false) }, onError: () => { setSpeaking(false); setLoading(false) } },
      getAudioCacheId(current.id, cueMode),
    )
    setLoading(false)
  }, [cueMode, current, isPlayerLine, voiceMap, speechRate])

  useEffect(() => {
    if (autoPlay && current && !isPlayerLine) {
      const t = setTimeout(() => playCurrentLine(), 300)
      return () => clearTimeout(t)
    }
  }, [index, autoPlay, current, isPlayerLine, playCurrentLine])

  const next = useCallback(() => {
    stop(); setSpeaking(false); setLoading(false); setRevealed(false)
    setIndex((i) => Math.min(i + 1, lines.length - 1))
  }, [lines.length])

  const prev = useCallback(() => {
    stop(); setSpeaking(false); setLoading(false); setRevealed(false)
    setIndex((i) => Math.max(i - 1, 0))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "Enter") next()
      if (e.key === "ArrowLeft") prev()
      if (e.key === " ") {
        e.preventDefault()
        if (isPlayerLine) setRevealed((r) => !r)
        else void playCurrentLine()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isPlayerLine, next, playCurrentLine, prev])

  if (!current) return null

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">

      {/* Wine progress bar */}
      <div className="h-1 rounded-full bg-ink/8 overflow-hidden">
        <div
          className="h-full rounded-full bg-wine transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Preload progress banner */}
      {!preload.done && (
        <div className="flex items-center gap-3 rounded-lg border border-wine/20 bg-wine/5 px-4 py-2.5">
          <div className="flex-1 h-1 rounded-full bg-ink/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-wine/50 transition-all duration-300"
              style={{ width: `${preload.total ? (preload.loaded / preload.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-wine/60 shrink-0">
            Preparando vozes {preload.loaded}/{preload.total}
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <button onClick={() => { stop(); onBack() }}
          className="text-xs text-ink/45 hover:text-ink/75 transition-colors tracking-wide">
          ← Voltar
        </button>
        <span className="font-mono text-xs text-ink/35">{index + 1} / {lines.length}</span>
        <button onClick={() => setShowSettings((s) => !s)}
          className="rounded-full border border-ink/10 px-3 py-1.5 text-xs text-ink/45 transition-colors hover:border-ink/20 hover:text-ink/75">
          Ajustes
        </button>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="rounded-lg border border-ink/10 bg-warm-white p-5 space-y-4 text-sm shadow-sm">
          <label className="flex items-center justify-between">
            <span className="text-ink/60 text-xs tracking-wide">Leitura automática</span>
            <button
              onClick={() => setAutoPlay((a) => !a)}
              aria-label={autoPlay ? "Desativar leitura automática" : "Ativar leitura automática"}
              aria-pressed={autoPlay}
              className={`relative w-10 h-5 rounded-full transition-colors ${autoPlay ? "bg-wine" : "bg-ink/15"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${autoPlay ? "translate-x-5" : ""}`} />
            </button>
          </label>
          <label className="flex items-center justify-between">
            <span className="text-ink/60 text-xs tracking-wide">Só deixa</span>
            <button
              onClick={() => setCueMode((enabled) => !enabled)}
              aria-label={cueMode ? "Desativar modo só deixa" : "Ativar modo só deixa"}
              aria-pressed={cueMode}
              className={`relative w-10 h-5 rounded-full transition-colors ${cueMode ? "bg-wine" : "bg-ink/15"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${cueMode ? "translate-x-5" : ""}`} />
            </button>
          </label>
          <div className="flex items-center justify-between gap-4">
            <span className="text-ink/60 text-xs tracking-wide">Velocidade</span>
            <div className="flex items-center gap-3">
              <input type="range" min={0.5} max={1.5} step={0.1} value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="w-24 accent-[#8B1E3F]" />
              <span className="text-ink/40 text-xs w-8 tabular-nums">{speechRate.toFixed(1)}×</span>
            </div>
          </div>
          {script.characters.filter(c => c !== playerCharacter).length > 0 && (
            <div className="pt-3 border-t border-ink/8 space-y-2">
              <p className="text-[10px] tracking-widest text-ink/30 uppercase">Vozes atribuídas</p>
              {script.characters.filter(c => c !== playerCharacter).map((char) => (
                <div key={char} className="flex justify-between text-xs">
                  <span className="text-ink/60 font-semibold">{char}</span>
                  <span className="text-ink/35">{VOICES.find(v => v.id === voiceMap[char])?.name ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Character badge */}
      <div>
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full border
          ${isPlayerLine
            ? "border-wine/30 bg-wine/8 text-wine"
            : "border-ink/12 bg-ink/4 text-ink/45"
          }`}>
          {isPlayerLine && <span className="w-1 h-1 rounded-full bg-wine inline-block" />}
          {current.character}
          {isPlayerLine && " — você"}
        </span>
      </div>

      {/* Line card */}
      <div className={`rounded-xl border p-7 md:p-10 min-h-[260px] flex flex-col justify-center gap-6 transition-colors
        ${isPlayerLine
          ? "border-wine/25 bg-wine/6"
          : "border-ink/10 bg-warm-white shadow-sm"
        }`}>

        {isPlayerLine ? (
          <>
            {revealed ? (
              <p className="font-display text-2xl md:text-4xl leading-relaxed font-medium text-ink">
                {current.text}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 items-end">
                {current.text.split(" ").map((w, i) => (
                  <span key={i} className="inline-block rounded-md h-6 bg-wine/20"
                    style={{ width: `${Math.max(28, w.length * 10)}px` }} />
                ))}
              </div>
            )}
            <button onClick={() => setRevealed((r) => !r)}
              className="self-start rounded-lg border border-wine/25 px-4 py-2 text-xs font-semibold tracking-wide text-wine transition-all hover:border-wine/50 hover:text-wine-dark">
              {revealed ? "Ocultar fala" : "Revelar fala"}
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-2xl md:text-4xl leading-relaxed text-ink/75">
              {cueMode ? getCueText(current.text) : current.text}
            </p>
            <button onClick={playCurrentLine} disabled={speaking || loading}
              className="self-start flex items-center gap-2 rounded-lg border border-ink/12 px-4 py-2 text-xs font-semibold tracking-wide text-ink/45 transition-all hover:border-wine/30 hover:text-wine disabled:opacity-30">
              {loading
                ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink/25 border-t-wine" /> Carregando...</>
                : speaking
                ? <>Reproduzindo...</>
                : <>Ouvir novamente</>}
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button onClick={prev} disabled={index === 0}
          className="flex-1 rounded-lg border border-ink/15 py-3.5 text-sm font-medium text-ink/50 transition-all hover:bg-ink/5 hover:text-ink/80 disabled:opacity-20">
          ← Anterior
        </button>
        {index === lines.length - 1 ? (
          <button onClick={() => { setIndex(0); setRevealed(false) }}
            className="flex-1 rounded-lg bg-gold hover:bg-[#b08930] py-3.5 text-sm font-bold text-warm-white transition-colors">
            Reiniciar
          </button>
        ) : (
          <button onClick={next}
            className="flex-1 rounded-lg bg-wine hover:bg-wine-dark py-3.5 text-sm font-bold text-warm-white transition-colors">
            Próxima →
          </button>
        )}
      </div>

      <p className="text-center text-[10px] tracking-widest text-ink/20 uppercase">modo prática</p>
    </div>
  )
}
