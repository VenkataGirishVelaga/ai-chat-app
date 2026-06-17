import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const {
    text,
    sender,
    timestamp,
    chatId,
  } = await req.json();

  const message =
    await prisma.message.create({
      data: {
        text,
        sender,
        timestamp,
        chatId,
      },
    });

  return NextResponse.json(message);
}