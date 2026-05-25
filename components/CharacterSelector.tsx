"use client"

import type { User } from "@supabase/supabase-js"
import type { ParsedScript } from "@/types/script"

interface Props {
  script: ParsedScript
  onSelect: (character: string) => void
  onBack: () => void
  user?: User | null
  savedId?: string | null
  saving?: boolean
  onSave?: () => void
}

export default function CharacterSelector({ script, onSelect, onBack, user, savedId, saving, onSave }: Props) {
  const counts = script.characters.reduce<Record<string, number>>((acc, c) => {
    acc[c] = script.lines.filter((l) => l.character === c && !l.isStageDirection).length
    return acc
  }, {})

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">

      {/* Header */}
      <div className="grid gap-5 border-b border-ink/10 pb-6 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-wine/65">Roteiro carregado</p>
          <h2 className="font-display text-4xl font-black leading-tight text-ink">{script.title}</h2>
        </div>
        <p className="max-w-56 text-sm leading-6 text-ink/55 sm:text-right">
          Qual personagem você vai interpretar?
        </p>
      </div>

      {/* Character cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {script.characters.map((char, i) => (
          <button
            key={char}
            onClick={() => onSelect(char)}
            className="group relative flex min-h-36 flex-col justify-between rounded-lg border border-ink/10 bg-warm-white px-5 py-5 text-left shadow-sm transition-all duration-200 hover:border-wine/35 hover:bg-white active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] text-gold">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="h-7 w-7 rounded-full border border-ink/10 text-center text-lg leading-6 text-wine/0 transition-all group-hover:border-wine/25 group-hover:text-wine">
                →
              </span>
            </div>
            <div className="space-y-2">
              <span className="block break-words font-display text-2xl font-bold leading-tight text-ink">
                {char}
              </span>
              <span className="text-xs text-ink/42 transition-colors group-hover:text-ink/60">
                {counts[char]} {counts[char] === 1 ? "fala" : "falas"}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-ink/40 hover:text-ink/75 transition-colors underline underline-offset-4"
        >
          Trocar roteiro
        </button>

        {/* Save button — shown only to logged-in users */}
        {user && onSave && (
          savedId ? (
            <span className="flex items-center gap-1 text-xs text-gold font-medium">
              <span>✓</span> Roteiro salvo
            </span>
          ) : (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg border border-ink/12 px-3 py-1.5 text-xs text-ink/45 transition-all hover:border-wine/30 hover:text-wine disabled:opacity-40"
            >
              {saving ? "Salvando…" : "↑ Salvar roteiro"}
            </button>
          )
        )}
      </div>
    </div>
  )
}
