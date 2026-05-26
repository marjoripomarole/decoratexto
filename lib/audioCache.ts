// Pre-generates and caches audio blobs from /api/tts so every line
// plays with zero latency. Generation runs 3 requests in parallel.

export type PreloadStatus = {
  total: number
  loaded: number
  failed: number
  done: boolean
  error?: string
}

const cache = new Map<string, string>() // lineId → ObjectURL
let _status: PreloadStatus = { total: 0, loaded: 0, failed: 0, done: true }
const _listeners = new Set<(s: PreloadStatus) => void>()

function emit(s: PreloadStatus) {
  _status = s
  _listeners.forEach((fn) => fn(s))
}

export function getStatus(): PreloadStatus { return _status }

export function onStatus(fn: (s: PreloadStatus) => void): () => void {
  _listeners.add(fn)
  fn(_status)
  return () => _listeners.delete(fn)
}

export function getCachedUrl(lineId: string): string | null {
  return cache.get(lineId) ?? null
}

export function clearCache() {
  cache.forEach((url) => URL.revokeObjectURL(url))
  cache.clear()
  emit({ total: 0, loaded: 0, failed: 0, done: true })
}

async function getErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: string }
    return data.error ?? "Não foi possível gerar as vozes."
  } catch {
    return "Não foi possível gerar as vozes."
  }
}

export async function preloadLines(
  items: Array<{ id: string; text: string; voiceId: string }>
) {
  clearCache()
  if (!items.length) return

  const total = items.length
  let loaded = 0
  let failed = 0
  let error: string | undefined
  emit({ total, loaded: 0, failed: 0, done: false })

  const queue = [...items]

  async function worker(): Promise<void> {
    const item = queue.shift()
    if (!item) return

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: item.text, voiceId: item.voiceId }),
      })
      if (res.ok) {
        const blob = await res.blob()
        cache.set(item.id, URL.createObjectURL(blob))
      } else {
        failed++
        error = await getErrorMessage(res)
      }
    } catch (err) {
      // line stays uncached — speak() will generate on demand as fallback
      failed++
      error = err instanceof Error ? err.message : "Não foi possível gerar as vozes."
    }

    loaded++
    emit({ total, loaded, failed, done: loaded === total, error })
    await worker() // recurse until queue empty
  }

  const CONCURRENCY = 3
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, total) }, worker)
  )
}
