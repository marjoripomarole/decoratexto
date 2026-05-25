"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useMemo, useCallback } from "react"
import type { ParsedScript } from "@/types/script"
import type { User } from "@supabase/supabase-js"
import ScriptUploader from "@/components/ScriptUploader"
import CharacterSelector from "@/components/CharacterSelector"
import PracticeView from "@/components/PracticeView"
import { createClient } from "@/lib/supabase/client"

type Stage = "upload" | "select" | "practice"
type ColorMode = "dark" | "light"

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
  const [colorMode, setColorMode] = useState<ColorMode>("dark")

  const supabase = useMemo(() => createClient(), [])

  const fetchSavedScripts = useCallback(async () => {
    const res = await fetch("/api/scripts")
    if (res.ok) setSavedScripts(await res.json())
  }, [])

  // Track auth state
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      if (user) void fetchSavedScripts()
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (nextUser) void fetchSavedScripts()
      else setSavedScripts([])
    })
    return () => subscription.unsubscribe()
  }, [fetchSavedScripts, supabase])

  useEffect(() => {
    const savedMode = window.localStorage.getItem("deixa-color-mode")
    if (savedMode === "light" || savedMode === "dark") {
      const frame = window.requestAnimationFrame(() => setColorMode(savedMode))
      return () => window.cancelAnimationFrame(frame)
    }
  }, [])

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

  function handleParsed(s: ParsedScript) { setScript(s); setSavedId(null); setStage("select") }
  function handleCharacterSelect(char: string) { setPlayerCharacter(char); setStage("practice") }
  function loadSaved(s: SavedScript) { setScript(s.parsed_script); setSavedId(s.id); setStage("select") }
  function toggleColorMode() {
    setColorMode((current) => {
      const next = current === "dark" ? "light" : "dark"
      window.localStorage.setItem("deixa-color-mode", next)
      return next
    })
  }

  const lightMode = colorMode === "light"

  return (
    <div className={`min-h-screen flex flex-col ${lightMode ? "bg-paper text-ink" : "stage-grid bg-ink text-paper"}`}>
      <main className="flex-1 flex flex-col">

        {/* ── UPLOAD STAGE ── */}
        {stage === "upload" && (
          <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl flex-col">

            {/* Auth bar */}
            <div className="flex items-center justify-between min-h-[36px]">
              <span className={`font-display text-xl font-black tracking-tight ${lightMode ? "text-ink" : "text-paper"}`}>Deixa</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleColorMode}
                  aria-pressed={lightMode}
                  aria-label={lightMode ? "Ativar modo escuro" : "Ativar modo claro"}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    lightMode
                      ? "border-ink/15 bg-white text-ink/65 hover:border-ink/30 hover:text-ink"
                      : "border-paper/12 bg-paper/[0.04] text-paper/60 hover:border-paper/25 hover:text-paper"
                  }`}
                >
                  {lightMode ? "Escuro" : "Claro"}
                </button>
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
                    <span className={`text-xs ${lightMode ? "text-ink/55" : "text-paper/55"}`}>
                      {(user.user_metadata.full_name as string)?.split(" ")[0]}
                    </span>
                    <button
                      onClick={handleLogout}
                      className={`text-[10px] transition-colors ${lightMode ? "text-ink/45 hover:text-ink/75" : "text-paper/45 hover:text-paper/75"}`}
                    >
                      Sair
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-all ${
                      lightMode
                        ? "border-ink/15 bg-white text-ink/65 hover:border-ink/30 hover:text-ink"
                        : "border-paper/12 bg-paper/[0.04] text-paper/60 hover:border-paper/25 hover:text-paper"
                    }`}
                  >
                    <GoogleIcon />
                    Entrar com Google
                  </button>
                  )
                )}
              </div>
            </div>

            <div className="flex flex-1 items-center justify-center py-8 lg:py-10">
              <section className="w-full max-w-xl">
                <div className={`rounded-xl border p-3 shadow-[0_24px_80px_rgba(0,0,0,0.16)] ${
                  lightMode ? "border-ink/10 bg-white" : "border-paper/12 bg-[#20201f]/90"
                }`}>
                  <div className={`rounded-lg border p-5 sm:p-6 ${lightMode ? "border-ink/8 bg-warm-white" : "border-paper/10 bg-ink"}`}>
                    <div className={`mb-5 flex items-start justify-between gap-4 border-b pb-4 ${lightMode ? "border-ink/10" : "border-paper/10"}`}>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-[0.24em] ${lightMode ? "text-wine" : "text-gold"}`}>novo roteiro</p>
                        <h2 className={`mt-2 text-xl font-semibold ${lightMode ? "text-ink" : "text-paper"}`}>Carregar cena</h2>
                      </div>
                    </div>
                    <ScriptUploader onParsed={handleParsed} tone={colorMode} />
                  </div>
                </div>

                {user && savedScripts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className={`text-[10px] tracking-[0.2em] uppercase ${lightMode ? "text-ink/40" : "text-paper/35"}`}>Meus roteiros</p>
                    {savedScripts.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSaved(s)}
                        className={`group flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all ${
                          lightMode
                            ? "border-ink/10 bg-white hover:border-wine/25 hover:bg-warm-white"
                            : "border-paper/10 bg-paper/[0.04] hover:border-gold/35 hover:bg-paper/[0.07]"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className={`truncate text-sm font-semibold ${lightMode ? "text-ink" : "text-paper"}`}>{s.title}</p>
                          <p className={`text-[10px] ${lightMode ? "text-ink/40" : "text-paper/35"}`}>
                            {s.parsed_script.characters.length} personagens
                          </p>
                        </div>
                        <span
                          role="button"
                          onClick={(e) => handleDeleteScript(e, s.id)}
                          className={`ml-3 shrink-0 text-xl leading-none opacity-0 transition-all group-hover:opacity-100 ${lightMode ? "text-ink/25 hover:text-wine" : "text-paper/20 hover:text-gold"}`}
                        >
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
            </div>
          </div>
        )}

        {/* ── SELECT STAGE ── */}
        {stage === "select" && script && (
          <div className="flex-1 flex items-center justify-center bg-paper px-4 py-16 text-ink">
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
          <div className="flex-1 flex items-center justify-center bg-paper px-4 py-8 text-ink">
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
