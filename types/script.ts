export interface ScriptLine {
  id: string
  character: string
  text: string
  isStageDirection: boolean
}

export interface ParsedScript {
  title: string
  characters: string[]
  lines: ScriptLine[]
}

export interface PracticeSettings {
  playerCharacter: string
  autoPlayTTS: boolean
  speechRate: number
  showLineBeforeReveal: boolean
}
