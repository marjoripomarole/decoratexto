"use client"

import { useId, useState } from "react"
import type { ParsedScript } from "@/types/script"

interface Props {
  onParsed: (script: ParsedScript) => void
}

export default function ScriptUploader({ onParsed }: Props) {
  const inputId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState("")

  async function handleFile(file: File) {
    setError("")
    setLoading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/parse-script", { method: "POST", body: form })
      let data: Record<string, unknown>
      try {
        data = await res.json()
      } catch {
        setError("Resposta inválida do servidor. Tente novamente.")
        return
      }
      if (!res.ok) {
        setError((data.error as string) ?? "Erro ao processar arquivo")
        return
      }
      onParsed(data as unknown as ParsedScript)
    } catch {
      setError("Erro de conexão. Verifique sua internet e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim()) return
    const blob = new Blob([pasteText], { type: "text/plain" })
    await handleFile(new File([blob], "roteiro.txt", { type: "text/plain" }))
  }

  if (pasteMode) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-3">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Cole o roteiro aqui...\n\nDica: nomes dos personagens em MAIÚSCULAS\n\nEXEMPLO:\nANA\nOlá, tudo bem?\n\nLARA\nTudo ótimo!"}
          className="w-full h-64 rounded-xl border border-gold/40 bg-warm-white p-4 text-sm font-mono text-charcoal resize-none outline-none focus:border-wine transition-colors placeholder:text-charcoal/30"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { setPasteMode(false); setError("") }}
            className="flex-1 rounded-xl border border-gold/40 py-2 text-sm text-charcoal/70 hover:bg-warm-white transition-colors"
          >
            Voltar
          </button>
          <button
            onClick={handlePasteSubmit}
            disabled={!pasteText.trim() || loading}
            className="flex-1 rounded-xl py-2 text-sm font-semibold text-warm-white bg-wine hover:bg-wine-dark disabled:opacity-40 transition-colors"
          >
            {loading ? "Analisando..." : "Analisar roteiro"}
          </button>
        </div>
        {error && <ErrorBox message={error} />}
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Drop zone — using <label> so clicking always opens file dialog natively */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors
          ${dragging ? "border-wine bg-wine/5" : "border-gold/40 hover:border-wine hover:bg-wine/5"}`}
      >
        <div className="text-5xl mb-4 pointer-events-none">📄</div>
        <p className="text-lg font-medium text-charcoal pointer-events-none">Arraste o roteiro aqui</p>
        <p className="text-sm text-charcoal/50 mt-1 pointer-events-none">ou clique para selecionar</p>
        <p className="text-xs text-charcoal/40 mt-3 pointer-events-none">.txt ou .pdf • máx. 10 MB</p>
      </label>

      {/* Native file input — associated via id/htmlFor, works on all browsers */}
      <input
        id={inputId}
        type="file"
        accept=".txt,.pdf,text/plain,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
      />

      {/* Explicit upload button as alternative */}
      <label
        htmlFor={inputId}
        className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-wine/30 bg-wine/5 py-3 text-sm font-semibold text-wine cursor-pointer hover:bg-wine/10 transition-colors"
      >
        📂 Selecionar arquivo PDF ou TXT
      </label>

      <button
        onClick={() => setPasteMode(true)}
        className="w-full text-sm text-charcoal/50 hover:text-wine underline transition-colors"
      >
        Ou cole o texto do roteiro diretamente
      </button>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-charcoal/50 animate-pulse">
          <span className="animate-spin inline-block">⏳</span> Analisando roteiro...
        </div>
      )}

      {error && <ErrorBox message={error} />}
    </div>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-wine/10 border border-wine/30 px-4 py-3 text-sm text-wine">
      ⚠️ {message}
    </div>
  )
}
