"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Continue; NextAuth signOut still clears the session cookie when possible.
        }
        await signOut({ callbackUrl: "/login" });
      }}
      className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
    >
      Sign out
    </button>
  );
}
