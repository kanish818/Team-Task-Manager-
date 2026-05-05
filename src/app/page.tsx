import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-6">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Team Task Manager</p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-900">Organize work with clarity</h1>
        <p className="mt-3 text-base text-zinc-600">
          Track projects, assign tasks, and stay ahead of deadlines in one place.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
