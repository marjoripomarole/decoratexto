import type { ParsedScript, ScriptLine } from "@/types/script"

// Detects if a line is a character cue (all-caps, short, no punctuation ending sentence)
function isCharacterCue(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed || trimmed.length > 50) return false
  // All caps with optional trailing whitespace/punctuation
  const upperVersion = trimmed.toUpperCase()
  if (upperVersion !== trimmed) return false
  // Must have at least 2 chars and be mostly letters
  if (!/[A-ZÁÉÍÓÚÀÂÊÔÃÕÜÇÑ]/.test(trimmed)) return false
  // Should not end with period (would be a sentence)
  if (trimmed.endsWith(".") && trimmed.split(" ").length > 3) return false
  return true
}

function isStageDirection(line: string): boolean {
  const t = line.trim()
  return (
    (t.startsWith("(") && t.endsWith(")")) ||
    (t.startsWith("[") && t.endsWith("]")) ||
    (t.startsWith("<") && t.endsWith(">"))
  )
}

export function parseScriptText(rawText: string, filename = ""): ParsedScript {
  const rawLines = rawText.split("\n")
  const scriptLines: ScriptLine[] = []
  const characterSet = new Set<string>()

  let currentCharacter = ""
  let lineBuffer: string[] = []
  let idCounter = 0

  function flush() {
    if (!currentCharacter || lineBuffer.length === 0) return
    const text = lineBuffer.join(" ").trim()
    if (!text) return
    const isDir = isStageDirection(text)
    if (!isDir) characterSet.add(currentCharacter)
    scriptLines.push({
      id: `line-${idCounter++}`,
      character: currentCharacter,
      text,
      isStageDirection: isDir,
    })
    lineBuffer = []
  }

  for (const raw of rawLines) {
    const line = raw.replace(/\r/g, "").trimEnd()

    if (!line.trim()) {
      // Empty line — flush current buffer
      flush()
      continue
    }

    if (isCharacterCue(line)) {
      flush()
      currentCharacter = line.trim()
      continue
    }

    // Continuation of current character's dialogue
    if (currentCharacter) {
      lineBuffer.push(line.trim())
    }
  }
  flush()

  // Derive title from filename
  const title = filename
    ? filename.replace(/\.(txt|pdf)$/i, "").replace(/[-_]/g, " ")
    : "Roteiro sem título"

  return {
    title,
    characters: Array.from(characterSet).sort(),
    lines: scriptLines,
  }
}
