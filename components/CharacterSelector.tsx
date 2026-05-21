"use client"

import type { ParsedScript } from "@/types/script"

interface Props {
  script: ParsedScript
  onSelect: (character: string) => void
  onBack: () => void
}

const COLORS = [
  "bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200",
  "bg-sky-100 border-sky-400 text-sky-800 hover:bg-sky-200",
  "bg-emerald-100 border-emerald-400 text-emerald-800 hover:bg-emerald-200",
  "bg-rose-100 border-rose-400 text-rose-800 hover:bg-rose-200",
  "bg-violet-100 border-violet-400 text-violet-800 hover:bg-violet-200",
  "bg-orange-100 border-orange-400 text-orange-800 hover:bg-orange-200",
]

export default function CharacterSelector({ script, onSelect, onBack }: Props) {
  const lineCounts = script.characters.reduce<Record<string, number>>((acc, c) => {
    acc[c] = script.lines.filter((l) => l.character === c && !l.isStageDirection).length
    return acc
  }, {})

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-800">{script.title}</h2>
        <p className="text-zinc-500 mt-1">Qual personagem você vai interpretar?</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {script.characters.map((char, i) => (
          <button
            key={char}
            onClick={() => onSelect(char)}
            className={`rounded-xl border-2 px-4 py-3 text-left transition-all ${COLORS[i % COLORS.length]}`}
          >
            <div className="font-bold text-sm">{char}</div>
            <div className="text-xs opacity-70 mt-0.5">
              {lineCounts[char]} {lineCounts[char] === 1 ? "fala" : "falas"}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onBack}
        className="w-full text-sm text-zinc-400 hover:text-zinc-600 underline transition-colors"
      >
        Trocar roteiro
      </button>
    </div>
  )
}
