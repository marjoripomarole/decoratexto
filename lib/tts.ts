// Wraps the Web Speech API for pt-BR TTS

let utterance: SpeechSynthesisUtterance | null = null

export function speak(text: string, rate = 1, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  stop()

  utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = "pt-BR"
  utterance.rate = rate

  // Prefer a pt-BR voice if available
  const voices = window.speechSynthesis.getVoices()
  const ptBR = voices.find((v) => v.lang === "pt-BR") ?? voices.find((v) => v.lang.startsWith("pt"))
  if (ptBR) utterance.voice = ptBR

  if (onEnd) utterance.onend = onEnd
  window.speechSynthesis.speak(utterance)
}

export function stop() {
  if (typeof window === "undefined") return
  window.speechSynthesis.cancel()
  utterance = null
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false
  return window.speechSynthesis.speaking
}
