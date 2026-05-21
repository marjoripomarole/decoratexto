import { NextRequest, NextResponse } from "next/server"
import { parseScriptText } from "@/lib/scriptParser"

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }

  const allowedTypes = ["text/plain", "application/pdf"]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Tipo de arquivo inválido. Use .txt ou .pdf" }, { status: 400 })
  }

  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 5 MB)" }, { status: 400 })
  }

  let text = ""

  if (file.type === "application/pdf") {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Dynamic import to avoid issues with pdf-parse in edge runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    text = data.text
  } else {
    text = await file.text()
  }

  const parsed = parseScriptText(text, file.name)

  if (parsed.characters.length === 0) {
    return NextResponse.json(
      { error: "Não foi possível detectar personagens. Certifique-se de que os nomes estão em MAIÚSCULAS." },
      { status: 422 }
    )
  }

  return NextResponse.json(parsed)
}
