// Azure Speech TTS via server-side proxy — checks audio cache first,
// falls back to on-demand API call if a line wasn't preloaded.
import { getCachedUrl } from "./audioCache"

let currentAudio: HTMLAudioElement | null = null

export async function speak(
  text: string,
  voiceId: string,
  options?: { rate?: number; onEnd?: () => void; onError?: (message?: string) => void },
  lineId?: string
) {
  stop()

  const cached = lineId ? getCachedUrl(lineId) : null
  let url: string
  let owned = false // true if we created the URL and must revoke it

  if (cached) {
    url = cached
  } else {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId }),
    })
    if (!res.ok) {
      options?.onError?.(await getErrorMessage(res))
      return
    }
    const blob = await res.blob()
    url = URL.createObjectURL(blob)
    owned = true
  }

  const audio = new Audio(url)
  audio.playbackRate = options?.rate ?? 1
  currentAudio = audio

  audio.onended = () => {
    if (owned) URL.revokeObjectURL(url)
    currentAudio = null
    options?.onEnd?.()
  }
  audio.onerror = () => {
    if (owned) URL.revokeObjectURL(url)
    currentAudio = null
    options?.onError?.("Não foi possível reproduzir a voz.")
  }

  try {
    await audio.play()
  } catch (err) {
    // Browser blocked autoplay (no user gesture) — reset state so
    // the "Ouvir novamente" button stays clickable.
    currentAudio = null
    if (owned) URL.revokeObjectURL(url)
    options?.onError?.(err instanceof Error ? err.message : "Não foi possível reproduzir a voz.")
  }
}

async function getErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: string }
    return data.error ?? "Não foi possível gerar a voz."
  } catch {
    return "Não foi possível gerar a voz."
  }
}

export function stop() {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
}

export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused
}
