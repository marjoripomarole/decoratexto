"use client"

import { useState } from "react"
import type { ParsedScript } from "@/types/script"
import ScriptUploader from "@/components/ScriptUploader"
import CharacterSelector from "@/components/CharacterSelector"
import PracticeView from "@/components/PracticeView"

type Stage = "upload" | "select" | "practice"

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload")
  const [script, setScript] = useState<ParsedScript | null>(null)
  const [playerCharacter, setPlayerCharacter] = useState("")

  function handleParsed(s: ParsedScript) { setScript(s); setStage("select") }
  function handleCharacterSelect(char: string) { setPlayerCharacter(char); setStage("practice") }

  return (
    <div className="min-h-screen flex flex-col bg-cream">

      <main className="flex-1 flex flex-col">

        {/* ── UPLOAD STAGE ── */}
        {stage === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-6">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.25em] text-wine/70 uppercase border border-wine/20 rounded-full px-3 py-1 bg-wine/5">
                <span className="w-1 h-1 rounded-full bg-wine/50 inline-block" />
                Para atores brasileiros
              </div>
              <h1
                className="font-display font-black text-charcoal leading-[0.95] tracking-tight"
                style={{ fontSize: "clamp(2.6rem, 9vw, 4.5rem)" }}
              >
                Memorize<br />
                <span className="text-wine italic">suas falas.</span>
              </h1>
              <p className="text-charcoal/50 text-sm max-w-[22rem] mx-auto leading-relaxed">
                Importe seu roteiro e pratique com voz em português brasileiro
              </p>
            </div>

            {/* Upload card */}
            <div className="w-full max-w-sm">
              <div className="bg-warm-white rounded-2xl p-5 shadow-[0_8px_40px_rgba(139,30,63,0.10)] border border-gold/20">
                <ScriptUploader onParsed={handleParsed} />
              </div>
            </div>

            {/* Minimal step hint */}
            <div className="flex items-center gap-2 text-[10px] text-charcoal/25 tracking-wide select-none">
              <span>Envie o roteiro</span>
              <span className="text-charcoal/15">→</span>
              <span>Escolha seu papel</span>
              <span className="text-charcoal/15">→</span>
              <span>Ouça e pratique</span>
            </div>
          </div>
        )}

        {/* ── SELECT STAGE ── */}
        {stage === "select" && script && (
          <div className="flex-1 flex items-center justify-center px-4 py-16">
            <CharacterSelector
              script={script}
              onSelect={handleCharacterSelect}
              onBack={() => setStage("upload")}
            />
          </div>
        )}

        {/* ── PRACTICE STAGE ── */}
        {stage === "practice" && script && (
          <div className="flex-1 flex items-center justify-center px-4 py-8">
            <PracticeView
              script={script}
              playerCharacter={playerCharacter}
              onBack={() => setStage("select")}
            />
          </div>
        )}

      </main>
    </div>
  )
}
