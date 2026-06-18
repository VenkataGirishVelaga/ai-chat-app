import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { chatId, title } = await req.json();

  const chat = await prisma.chat.update({
    where: {
      id: chatId,
    },
    data: {
      title,
    },
  });

  return NextResponse.json(chat);
}