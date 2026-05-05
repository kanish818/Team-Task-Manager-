import type { ReactNode } from "react";
import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";

type Role = "ADMIN" | "MEMBER";

type AppShellProps = {
  userName: string;
  role: Role;
  children: ReactNode;
};

export default function AppShell({ userName, role, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Team Task Manager</p>
            <h1 className="text-xl font-semibold text-zinc-900">Welcome, {userName}</h1>
            <p className="text-sm text-zinc-500">Role: {role}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            <Link className="rounded-full px-3 py-1 text-zinc-600 hover:bg-zinc-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="rounded-full px-3 py-1 text-zinc-600 hover:bg-zinc-100" href="/projects">
              Projects
            </Link>
            <Link className="rounded-full px-3 py-1 text-zinc-600 hover:bg-zinc-100" href="/tasks">
              Tasks
            </Link>
          </nav>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
