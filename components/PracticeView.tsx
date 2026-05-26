"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import type { ParsedScript, ScriptLine } from "@/types/script"
import { speak, stop } from "@/lib/tts"
import { VOICES } from "@/lib/voices"
import { preloadLines, clearCache, onStatus, type PreloadStatus } from "@/lib/audioCache"

type LineAttempt = "passed" | "failed"
type RecallMode = "read" | "first-letter" | "keyword" | "blackout"

const RECALL_MODES: Array<{ id: RecallMode; label: string }> = [
  { id: "read", label: "Ler" },
  { id: "first-letter", label: "Iniciais" },
  { id: "keyword", label: "Palavras-chave" },
  { id: "blackout", label: "Blackout" },
]

const RECALL_MODE_LABELS: Record<RecallMode, string> = {
  read: "Ler",
  "first-letter": "Iniciais",
  keyword: "Palavras-chave",
  blackout: "Blackout",
}

const STOPWORDS = new Set([
  "a", "as", "ao", "aos", "e", "em", "eu", "o", "os", "ou", "um", "uma", "uns", "umas",
  "de", "da", "das", "do", "dos", "me", "meu", "minha", "na", "nas", "no", "nos", "por",
  "pra", "para", "que", "se", "te", "tu", "voce", "voces", "com",
])

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

export function getFirstLetterHint(text: string): string {
  return text.replace(/\p{L}[\p{L}\p{M}]*/gu, (word) => `${word[0]}${"_".repeat(Math.max(1, word.length - 1))}`)
}

export function getKeywordHint(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) return part

      const core = part.match(/[\p{L}\p{M}]+/gu)?.join("") ?? ""
      const normalized = core.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()

      if (core.length >= 5 && !STOPWORDS.has(normalized)) return part

      return part.replace(/\p{L}/gu, "_")
    })
    .join("")
}

function getRecallModeText(text: string, mode: RecallMode): string {
  if (mode === "read") return text
  if (mode === "first-letter") return getFirstLetterHint(text)
  if (mode === "keyword") return getKeywordHint(text)
  return ""
}

function getAudioCacheId(lineId: string, cueMode: boolean): string {
  return cueMode ? `${lineId}:cue` : lineId
}

function getNextRecallMode(mode: RecallMode): RecallMode {
  const index = RECALL_MODES.findIndex((item) => item.id === mode)
  return RECALL_MODES[Math.min(index + 1, RECALL_MODES.length - 1)].id
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
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState<Record<string, LineAttempt>>({})
  const [recallModes, setRecallModes] = useState<Record<string, RecallMode>>({})
  const [successStreaks, setSuccessStreaks] = useState<Record<string, number>>({})
  const [preload, setPreload] = useState<PreloadStatus>({ total: 0, loaded: 0, failed: 0, done: true })

  const current = lines[index]
  const isPlayerLine = current?.character === playerCharacter
  const currentRecallMode = current ? recallModes[current.id] ?? "read" : "read"
  const currentSuccessStreak = current ? successStreaks[current.id] ?? 0 : 0
  const progress = ((index + 1) / lines.length) * 100
  const playerLines = useMemo(() => lines.filter((l) => l.character === playerCharacter), [lines, playerCharacter])
  const markedPlayerLines = playerLines.filter((l) => attempts[l.id])
  const passedPlayerLines = playerLines.filter((l) => attempts[l.id] === "passed")
  const mastery = playerLines.length ? Math.round((passedPlayerLines.length / playerLines.length) * 100) : 0

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
    setVoiceError(null)
    setLoading(true); setSpeaking(true)
    await speak(
      spokenText, voiceId,
      { rate: speechRate, onEnd: () => { setSpeaking(false); setLoading(false) }, onError: (message) => { setVoiceError(message ?? "Não foi possível reproduzir a voz."); setSpeaking(false); setLoading(false) } },
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

  const markCurrentLine = useCallback((attempt: LineAttempt) => {
    if (!current || !isPlayerLine) return

    const nextStreak = attempt === "passed" ? currentSuccessStreak + 1 : 0

    setAttempts((currentAttempts) => ({ ...currentAttempts, [current.id]: attempt }))
    setSuccessStreaks((currentStreaks) => ({ ...currentStreaks, [current.id]: nextStreak >= 3 ? 0 : nextStreak }))

    if (nextStreak >= 3) {
      setRecallModes((currentModes) => ({
        ...currentModes,
        [current.id]: getNextRecallMode(currentModes[current.id] ?? currentRecallMode),
      }))
    }

    next()
  }, [current, currentRecallMode, currentSuccessStreak, isPlayerLine, next])

  const setCurrentRecallMode = useCallback((mode: RecallMode) => {
    if (!current || !isPlayerLine) return

    setRevealed(false)
    setSuccessStreaks((currentStreaks) => ({ ...currentStreaks, [current.id]: 0 }))
    setRecallModes((currentModes) => ({ ...currentModes, [current.id]: mode }))
  }, [current, isPlayerLine])

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

  const showFullPlayerText = isPlayerLine && (revealed || currentRecallMode === "read")
  const recallText = getRecallModeText(current.text, currentRecallMode)

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

      {/* Voice error banner */}
      {(voiceError || (preload.done && preload.failed > 0)) && (
        <div className="rounded-lg border border-wine/20 bg-wine/8 px-4 py-3 text-xs leading-relaxed text-wine">
          {voiceError ?? preload.error ?? "Não foi possível gerar algumas vozes."}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between border-b border-ink/10 pb-4">
        <button onClick={() => { stop(); onBack() }}
          className="text-xs text-ink/45 hover:text-ink/75 transition-colors tracking-wide">
          ← Voltar
        </button>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-ink/35">{index + 1} / {lines.length}</span>
          {playerLines.length > 0 && (
            <span className="rounded-full border border-ink/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-ink/40">
              {passedPlayerLines.length}/{playerLines.length} · {mastery}%
            </span>
          )}
        </div>
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
              onClick={() => { setVoiceError(null); setCueMode((enabled) => !enabled) }}
              aria-label={cueMode ? "Desativar modo só deixa" : "Ativar modo só deixa"}
              aria-pressed={cueMode}
              className={`relative w-10 h-5 rounded-full transition-colors ${cueMode ? "bg-wine" : "bg-ink/15"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${cueMode ? "translate-x-5" : ""}`} />
            </button>
          </label>
          {isPlayerLine && (
            <div className="space-y-2">
              <span className="text-ink/60 text-xs tracking-wide">Modo de memória</span>
              <div className="grid grid-cols-2 gap-2">
                {RECALL_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setCurrentRecallMode(mode.id)}
                    aria-pressed={currentRecallMode === mode.id}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-all ${currentRecallMode === mode.id
                      ? "border-wine bg-wine text-warm-white"
                      : "border-ink/10 text-ink/45 hover:border-ink/25 hover:text-ink/70"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}
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
          {attempts[current.id] === "passed" && " · acertei"}
          {attempts[current.id] === "failed" && " · revisar"}
          {isPlayerLine && ` · ${RECALL_MODE_LABELS[currentRecallMode].toLowerCase()}`}
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
            {showFullPlayerText ? (
              <p className="font-display text-2xl md:text-4xl leading-relaxed font-medium text-ink">
                {current.text}
              </p>
            ) : currentRecallMode === "blackout" ? (
              <div className="flex flex-wrap gap-1.5 items-end">
                {current.text.split(" ").map((w, i) => (
                  <span key={i} className="inline-block rounded-md h-6 bg-wine/20"
                    style={{ width: `${Math.max(28, w.length * 10)}px` }} />
                ))}
              </div>
            ) : (
              <p className="font-display text-2xl md:text-4xl leading-relaxed font-medium text-ink">
                {recallText}
              </p>
            )}
            {currentRecallMode !== "read" && (
              <button onClick={() => setRevealed((r) => !r)}
                className="self-start rounded-lg border border-wine/25 px-4 py-2 text-xs font-semibold tracking-wide text-wine transition-all hover:border-wine/50 hover:text-wine-dark">
                {revealed ? "Ocultar fala" : "Revelar fala"}
              </button>
            )}
            {currentSuccessStreak > 0 && (
              <p className="text-xs text-ink/35">
                Sequência {currentSuccessStreak}/3
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                onClick={() => markCurrentLine("passed")}
                aria-pressed={attempts[current.id] === "passed"}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${attempts[current.id] === "passed"
                  ? "border-wine bg-wine text-warm-white"
                  : "border-wine/25 text-wine hover:border-wine/50"
                }`}
              >
                Acertei
              </button>
              <button
                onClick={() => markCurrentLine("failed")}
                aria-pressed={attempts[current.id] === "failed"}
                className={`rounded-lg border px-4 py-3 text-sm font-semibold transition-all ${attempts[current.id] === "failed"
                  ? "border-ink/40 bg-ink/10 text-ink/70"
                  : "border-ink/15 text-ink/45 hover:border-ink/30 hover:text-ink/70"
                }`}
              >
                Precisei ver
              </button>
            </div>
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

      {playerLines.length > 0 && (
        <p className="text-center text-[10px] tracking-widest text-ink/25 uppercase">
          {markedPlayerLines.length}/{playerLines.length} falas marcadas
        </p>
      )}
    </div>
  )
}
