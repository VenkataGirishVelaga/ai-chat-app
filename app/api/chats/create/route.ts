import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { title, userId } = await req.json();

  const chat = await prisma.chat.create({
    data: {
      title,
      userId,
    },
  });

  return NextResponse.json(chat);
}