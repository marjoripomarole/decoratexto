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
    <div className="w-full max-w-lg mx-auto space-y-8">

      {/* Header */}
      <div className="text-center space-y-2">
        <p className="text-[10px] tracking-[0.3em] text-wine/60 uppercase">Roteiro carregado</p>
        <h2 className="font-display font-bold text-charcoal text-3xl leading-tight">{script.title}</h2>
        <p className="text-charcoal/50 text-sm">Qual personagem você vai interpretar?</p>
      </div>

      {/* Character cards */}
      <div className="grid grid-cols-2 gap-3">
        {script.characters.map((char, i) => (
          <button
            key={char}
            onClick={() => onSelect(char)}
            className="group relative flex flex-col gap-2 rounded-2xl border border-charcoal/10 bg-warm-white px-5 py-5 text-left transition-all duration-200 hover:border-wine/35 hover:bg-wine/5 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
          >
            <span className="font-mono text-[10px] tracking-widests text-gold">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="font-display font-bold text-charcoal text-xl leading-tight break-words">
              {char}
            </span>
            <span className="text-charcoal/35 text-xs group-hover:text-charcoal/50 transition-colors">
              {counts[char]} {counts[char] === 1 ? "fala" : "falas"}
            </span>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-wine/0 group-hover:text-wine/50 transition-all text-lg">→</span>
          </button>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-charcoal/30 hover:text-charcoal/70 transition-colors underline underline-offset-4"
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
              className="flex items-center gap-1.5 text-xs text-charcoal/40 hover:text-wine border border-charcoal/12 hover:border-wine/30 rounded-lg px-3 py-1.5 transition-all disabled:opacity-40"
            >
              {saving ? "Salvando…" : "↑ Salvar roteiro"}
            </button>
          )
        )}
      </div>
    </div>
  )
}
