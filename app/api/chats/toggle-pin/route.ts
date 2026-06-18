import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { chatId, pinned } =
    await req.json();

  const chat =
    await prisma.chat.update({
      where: {
        id: chatId,
      },
      data: {
        pinned,
      },
    });

  return NextResponse.json(chat);
}