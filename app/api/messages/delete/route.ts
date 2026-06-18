import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const { ids } = await req.json();

  console.log("DELETE IDS:", ids);

  const result = await prisma.message.deleteMany({
    where: {
      id: { in: ids },
    },
  });

  console.log("DELETED COUNT:", result.count);

  // ✅ This was missing — without it, fetch gets no response and silently fails
  return NextResponse.json({ deleted: result.count });
}