"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useMemo } from "react"
import type { ParsedScript } from "@/types/script"
import type { User } from "@supabase/supabase-js"
import ScriptUploader from "@/components/ScriptUploader"
import CharacterSelector from "@/components/CharacterSelector"
import PracticeView from "@/components/PracticeView"
import { createClient } from "@/lib/supabase/client"

type Stage = "upload" | "select" | "practice"

interface SavedScript {
  id: string
  title: string
  created_at: string
  parsed_script: ParsedScript
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("upload")
  const [script, setScript] = useState<ParsedScript | null>(null)
  const [playerCharacter, setPlayerCharacter] = useState("")

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([])
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  // Track auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  // Load saved scripts when user logs in
  useEffect(() => {
    if (user) fetchSavedScripts()
    else setSavedScripts([])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Reset saved badge when a different script is loaded
  useEffect(() => { setSavedId(null) }, [script])

  async function fetchSavedScripts() {
    const res = await fetch("/api/scripts")
    if (res.ok) setSavedScripts(await res.json())
  }

  async function handleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setSavedScripts([])
  }

  async function handleSave() {
    if (!script || !user || savedId) return
    setSaving(true)
    const res = await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: script.title, parsed_script: script }),
    })
    if (res.ok) {
      const saved = await res.json()
      setSavedId(saved.id)
      setSavedScripts((prev) => [saved, ...prev])
    }
    setSaving(false)
  }

  async function handleDeleteScript(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await fetch(`/api/scripts?id=${id}`, { method: "DELETE" })
    setSavedScripts((prev) => prev.filter((s) => s.id !== id))
    if (savedId === id) setSavedId(null)
  }

  function handleParsed(s: ParsedScript) { setScript(s); setStage("select") }
  function handleCharacterSelect(char: string) { setPlayerCharacter(char); setStage("practice") }
  function loadSaved(s: SavedScript) { setScript(s.parsed_script); setSavedId(s.id); setStage("select") }

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <main className="flex-1 flex flex-col">

        {/* ── UPLOAD STAGE ── */}
        {stage === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-6">

            {/* Auth bar */}
            <div className="w-full max-w-sm flex justify-end min-h-[28px]">
              {!authLoading && (
                user ? (
                  <div className="flex items-center gap-2">
                    {user.user_metadata.avatar_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.user_metadata.avatar_url as string}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span className="text-xs text-charcoal/50">
                      {(user.user_metadata.full_name as string)?.split(" ")[0]}
                    </span>
                    <button
                      onClick={handleLogout}
                      className="text-[10px] text-charcoal/30 hover:text-charcoal/60 transition-colors"
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="flex items-center gap-1.5 text-xs text-charcoal/40 hover:text-charcoal/70 border border-charcoal/10 hover:border-charcoal/20 rounded-lg px-3 py-1.5 transition-all bg-warm-white shadow-sm"
                  >
                    <GoogleIcon />
                    Entrar com Google
                  </button>
                )
              )}
            </div>

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

            {/* Saved scripts (logged-in only) */}
            {user && savedScripts.length > 0 && (
              <div className="w-full max-w-sm space-y-2">
                <p className="text-[10px] tracking-[0.2em] text-charcoal/30 uppercase">Meus roteiros</p>
                {savedScripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSaved(s)}
                    className="w-full flex items-center justify-between rounded-xl border border-charcoal/10 bg-warm-white px-4 py-3 text-left hover:border-wine/30 hover:bg-wine/5 transition-all group shadow-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-charcoal truncate">{s.title}</p>
                      <p className="text-[10px] text-charcoal/30">
                        {s.parsed_script.characters.length} personagens
                      </p>
                    </div>
                    <span
                      role="button"
                      onClick={(e) => handleDeleteScript(e, s.id)}
                      className="ml-3 shrink-0 text-xl leading-none text-charcoal/20 hover:text-wine opacity-0 group-hover:opacity-100 transition-all"
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Step hints */}
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
              user={user}
              savedId={savedId}
              saving={saving}
              onSave={handleSave}
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

function GoogleIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
