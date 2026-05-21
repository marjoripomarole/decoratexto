// Uses the browser's built-in SpeechSynthesis API with pt-BR voices.
// On macOS/iOS: Luciana; Chrome/Android: Google pt-BR; Windows: Francisca.
// No API calls needed — runs entirely client-side.

let currentUtterance: SpeechSynthesisUtterance | null = null

function getPtBRVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis
    .getVoices()
    .filter((v) => v.lang === "pt-BR" || v.lang === "pt_BR" || v.lang.startsWith("pt-BR"))
}

export async function speak(
  text: string,
  voiceId: string,
  options?: { rate?: number; onEnd?: () => void; onError?: () => void }
) {
  stop()

  return new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = "pt-BR"
    utter.rate = options?.rate ?? 1

    // Try to pick a specific pt-BR voice by index for character differentiation
    const voices = getPtBRVoices()
    const idx = parseInt(voiceId, 10)
    if (voices.length > 0) utter.voice = voices[idx % voices.length]

    currentUtterance = utter

    utter.onend = () => {
      currentUtterance = null
      options?.onEnd?.()
      resolve()
    }
    utter.onerror = () => {
      currentUtterance = null
      options?.onError?.()
      resolve()
    }

    window.speechSynthesis.speak(utter)
  })
}

export function stop() {
  window.speechSynthesis.cancel()
  currentUtterance = null
}

export function isSpeaking(): boolean {
  return window.speechSynthesis.speaking
}
