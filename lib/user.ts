import { prisma } from "@/lib/prisma";

export async function createUserIfNotExists(
  id: string,
  email: string,
  name?: string | null,
  image?: string | null
) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) return existingUser;

  return prisma.user.create({
    data: {
      id,
      email,
      name,
      image,
    },
  });
}