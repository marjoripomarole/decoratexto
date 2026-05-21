"use client"

import { useRef, useState } from "react"
import type { ParsedScript } from "@/types/script"

interface Props {
  onParsed: (script: ParsedScript) => void
}

export default function ScriptUploader({ onParsed }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setError("")
    setLoading(true)
    const form = new FormData()
    form.append("file", file)
    const res = await fetch("/api/parse-script", { method: "POST", body: form })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error ?? "Erro ao processar arquivo")
      return
    }
    onParsed(data as ParsedScript)
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim()) return
    setError("")
    setLoading(true)
    const blob = new Blob([pasteText], { type: "text/plain" })
    const file = new File([blob], "roteiro.txt", { type: "text/plain" })
    await handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {!pasteMode ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors
              ${dragging ? "border-amber-400 bg-amber-50" : "border-zinc-300 hover:border-amber-400 hover:bg-amber-50/50"}`}
          >
            <div className="text-5xl mb-4">📄</div>
            <p className="text-lg font-medium text-zinc-700">
              Arraste o roteiro aqui
            </p>
            <p className="text-sm text-zinc-500 mt-1">ou clique para selecionar</p>
            <p className="text-xs text-zinc-400 mt-3">.txt ou .pdf • máx. 5 MB</p>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,.pdf,text/plain,application/pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>

          <button
            onClick={() => setPasteMode(true)}
            className="w-full text-sm text-zinc-500 hover:text-amber-600 underline transition-colors"
          >
            Ou cole o texto do roteiro diretamente
          </button>
        </>
      ) : (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Cole o roteiro aqui...\n\nDica: os nomes dos personagens devem estar em MAIÚSCULAS\n\nEXEMPLO:\nMARIA\nOlá, tudo bem?\n\nJOÃO\nTudo ótimo, obrigado!"}
            className="w-full h-64 rounded-xl border border-zinc-300 p-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setPasteMode(false)}
              className="flex-1 rounded-xl border border-zinc-300 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={handlePasteSubmit}
              disabled={!pasteText.trim() || loading}
              className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              Analisar roteiro
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center text-sm text-zinc-500 animate-pulse">
          Analisando roteiro...
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  )
}
