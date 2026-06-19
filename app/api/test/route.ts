// app/api/test/route.ts

import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const count = await prisma.user.count();

    return Response.json({
      success: true,
      count,
    });
  } catch (e: any) {
    return Response.json({
      success: false,
      error: e.message,
    });
  }
}