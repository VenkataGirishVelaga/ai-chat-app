import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const chatId =
    req.nextUrl.searchParams.get("chatId");

  if (!chatId) {
    return NextResponse.json(
      { error: "Missing chatId" },
      { status: 400 }
    );
  }

  const messages =
    await prisma.message.findMany({
      where: {
        chatId,
      },
      orderBy: {
        id: "asc",
      },
    });

  return NextResponse.json(messages);
}