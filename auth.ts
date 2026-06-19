import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const {
    
  handlers,
  signIn,
  signOut,
  auth,
} = NextAuth({
  debug:true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async signIn({ user }) {
    if (!user.email) return false;

    const existingUser = await prisma.user.findUnique({
      where: { email: user.email },
    });

    if (!existingUser) {
      await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: user.email,
          name: user.name,
          image: user.image,
        },
      });
    }

    return true;
  },
}});