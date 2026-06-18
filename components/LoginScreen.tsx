"use client";

import { signIn } from "next-auth/react";

export default function LoginScreen() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6">
      <h1 className="text-5xl font-bold">
        AI Chat App
      </h1>

      <p className="text-zinc-400">
        Sign in to start chatting
      </p>

      <button
        onClick={() => signIn("google")}
        className="bg-blue-500 hover:bg-blue-600 px-6 py-3 rounded-lg"
      >
        Continue with Google
      </button>
    </div>
  );
}