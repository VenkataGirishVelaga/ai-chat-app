import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    if (file.type === "text/plain") {
      const text = await file.text();
      return NextResponse.json({ text: `[File Content]\n${text}` });
    }

    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(buffer);

      return NextResponse.json({ text: `[Resume/PDF Content]\n${data.text}` });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}