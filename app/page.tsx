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

  function handleParsed(s: ParsedScript) {
    setScript(s)
    setStage("select")
  }

  function handleCharacterSelect(char: string) {
    setPlayerCharacter(char)
    setStage("practice")
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4 flex items-center gap-3">
        <span className="text-2xl">🎭</span>
        <div>
          <h1 className="text-lg font-bold text-zinc-800 leading-tight">Decora Linhas</h1>
          <p className="text-xs text-zinc-500">Seu assistente de memorização</p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {stage === "upload" && (
          <div className="w-full max-w-xl space-y-8">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold text-zinc-800">
                Memorize suas falas
              </h2>
              <p className="text-zinc-500">
                Importe seu roteiro e pratique com voz em português brasileiro
              </p>
            </div>
            <ScriptUploader onParsed={handleParsed} />
            <div className="rounded-xl bg-white border border-zinc-200 p-5 space-y-2 text-sm text-zinc-600">
              <p className="font-semibold text-zinc-700">Como usar:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Envie seu roteiro em .txt ou .pdf</li>
                <li>Os nomes dos personagens devem estar em <strong>MAIÚSCULAS</strong></li>
                <li>Escolha o personagem que você vai interpretar</li>
                <li>O app lê as falas dos outros personagens em voz alta</li>
                <li>Suas falas ficam ocultas até você revelar</li>
              </ol>
            </div>
          </div>
        )}

        {stage === "select" && script && (
          <CharacterSelector
            script={script}
            onSelect={handleCharacterSelect}
            onBack={() => setStage("upload")}
          />
        )}

        {stage === "practice" && script && (
          <PracticeView
            script={script}
            playerCharacter={playerCharacter}
            onBack={() => setStage("select")}
          />
        )}
      </main>
    </div>
  )
}
