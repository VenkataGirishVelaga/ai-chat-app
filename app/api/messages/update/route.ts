import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { messageId, text } =
    await req.json();

  console.log("UPDATING:", messageId);

  const message =
    await prisma.message.update({
      where: {
        id: messageId,
      },
      data: {
        text,
      },
    });

  console.log("UPDATED MESSAGE:", message);

  return NextResponse.json(message);
}