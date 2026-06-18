import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const { chatId } = await req.json();

  // delete messages first
  await prisma.message.deleteMany({
    where: {
      chatId,
    },
  });

  // then delete chat
  await prisma.chat.delete({
    where: {
      id: chatId,
    },
  });

  return NextResponse.json({
    success: true,
  });
}