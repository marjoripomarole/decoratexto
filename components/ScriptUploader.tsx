"use client"

import { useId, useState } from "react"
import type { ParsedScript } from "@/types/script"

interface Props {
  onParsed: (script: ParsedScript) => void
  tone?: "dark" | "light"
}

export default function ScriptUploader({ onParsed, tone = "dark" }: Props) {
  const inputId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteText, setPasteText] = useState("")
  const light = tone === "light"

  const textStrong = light ? "text-ink" : "text-paper"
  const textMuted = light ? "text-ink/55" : "text-paper/45"
  const panelField = light
    ? "border-ink/12 bg-white text-ink placeholder:text-ink/25 focus:border-wine/55 focus:ring-wine/10"
    : "border-paper/12 bg-paper/[0.06] text-paper placeholder:text-paper/25 focus:border-gold/70 focus:ring-gold/15"
  const secondaryButton = light
    ? "border-ink/12 text-ink/62 hover:border-ink/24 hover:text-ink hover:bg-ink/[0.03]"
    : "border-paper/12 text-paper/62 hover:border-paper/24 hover:text-paper"
  const errorTone = light
    ? "bg-wine/8 border-wine/25 text-wine"
    : "bg-wine/15 border-wine/35 text-paper"

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
      <div className="space-y-4">
        <div className="space-y-1">
          <p className={`text-sm font-semibold ${textStrong}`}>Cole o roteiro</p>
          <p className={`text-xs ${textMuted}`}>Nomes dos personagens em MAIÚSCULAS em uma linha separada</p>
        </div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"ANA\nOlá, tudo bem?\n\nLARA\nTudo ótimo!"}
          className={`w-full h-52 rounded-lg border p-4 text-sm font-mono resize-none outline-none focus:ring-2 transition-all ${panelField}`}
        />
        <div className="flex gap-2">
          <button
            onClick={() => { setPasteMode(false); setError("") }}
            className={`flex-1 rounded-lg border py-2.5 text-sm transition-colors ${secondaryButton}`}
          >
            Voltar
          </button>
          <button
            onClick={handlePasteSubmit}
            disabled={!pasteText.trim() || loading}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-ink bg-gold hover:bg-[#d5ad52] disabled:opacity-40 transition-colors"
          >
            {loading ? "Analisando..." : "Analisar roteiro"}
          </button>
        </div>
        {error && <ErrorBox message={error} tone={errorTone} />}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <label
        htmlFor={inputId}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group flex min-h-44 cursor-pointer flex-col justify-between rounded-lg border p-5 text-left transition-all
          ${dragging
            ? "border-gold bg-gold/10"
            : light
            ? "border-ink/12 bg-white hover:border-wine/35 hover:bg-warm-white"
            : "border-paper/15 bg-paper/[0.04] hover:border-gold/55 hover:bg-paper/[0.07]"
          }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-md border ${light ? "border-ink/12 bg-paper text-ink/70" : "border-paper/15 bg-ink text-paper/80"}`}>
            <span className="h-5 w-4 rounded-[2px] border border-current border-t-4" aria-hidden="true" />
          </div>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ${light ? "border-ink/10 text-ink/45" : "border-paper/10 text-paper/45"}`}>
            txt / pdf
          </span>
        </div>
        <div className="space-y-1">
          <p className={`text-base font-semibold pointer-events-none ${textStrong}`}>
            {dragging ? "Solte o roteiro" : "Arraste o roteiro"}
          </p>
          <p className={`text-xs pointer-events-none ${textMuted}`}>Max. 10 MB</p>
        </div>
      </label>

      <input
        id={inputId}
        type="file"
        accept=".txt,.pdf,text/plain,application/pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = "" }}
      />

      <label
        htmlFor={inputId}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-gold py-3 text-sm font-bold text-ink shadow-[0_14px_34px_rgba(200,155,60,0.22)] transition-colors hover:bg-[#d5ad52]"
      >
        {loading
          ? <><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-ink/30 border-t-ink" /> Analisando...</>
          : <>Selecionar arquivo</>
        }
      </label>

      <button
        onClick={() => setPasteMode(true)}
        className={`w-full rounded-lg border py-2 text-xs font-medium transition-colors ${secondaryButton}`}
      >
        Colar texto diretamente
      </button>

      {error && <ErrorBox message={error} tone={errorTone} />}
    </div>
  )
}

function ErrorBox({ message, tone }: { message: string; tone: string }) {
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm ${tone}`}>
      {message}
    </div>
  )
}
