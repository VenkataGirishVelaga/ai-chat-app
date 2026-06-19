import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const userId =
      req.nextUrl.searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId" },
        { status: 400 }
      );
    }

    const chats = await prisma.chat.findMany({
      where: {
        userId,
      },
      include: {
        messages: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(chats);
  } catch (error) {
  console.error("CHAT API ERROR:", error);

  return NextResponse.json(
    {
      error: String(error),
    },
    {
      status: 500,
    }
  );
}
}
