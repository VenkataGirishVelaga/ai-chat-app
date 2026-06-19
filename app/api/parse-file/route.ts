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
      const { extractText, getDocumentProxy } = await import("unpdf");

      const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
      const { text } = await extractText(pdf, { mergePages: true });

      if (!text?.trim()) {
        return NextResponse.json({ error: "Could not extract text. PDF may be scanned/image-based." }, { status: 400 });
      }

      return NextResponse.json({ text: `[Resume/PDF Content]\n${text}` });
    }

    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  } catch (err) {
    console.error("Parse error:", err);
    return NextResponse.json({ error: "Failed to parse file" }, { status: 500 });
  }
}