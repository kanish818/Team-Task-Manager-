"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Role = "ADMIN" | "MEMBER";

export type ProjectListItem = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  createdById: string;
  members: { id: string; userId: string }[];
};

type ProjectsClientProps = {
  role: Role;
};

export default function ProjectsClient({ role }: ProjectsClientProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProjects = useCallback(
    async ({ withLoading, cursor }: { withLoading: boolean; cursor?: string }) => {
    if (withLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (cursor) params.set("cursor", cursor);
      const url = params.toString() ? `/api/projects?${params.toString()}` : "/api/projects";
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Failed to load projects");
      }
      const payload = await response.json();
      if (cursor) {
        setProjects((prev) => [...prev, ...(payload.projects ?? [])]);
      } else {
        setProjects(payload.projects ?? []);
      }
      setNextCursor(payload.nextCursor ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await fetchProjects({ withLoading: false });
    };
    void load();
    return () => {
      active = false;
    };
  }, [fetchProjects]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Project title is required.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || undefined }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Failed to create project");
      }

      setTitle("");
      setDescription("");
      await fetchProjects({ withLoading: false });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchProjects({ withLoading: true });
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchProjects({ withLoading: false, cursor: nextCursor });
    setLoadingMore(false);
  };

  return (
    <div className="space-y-6">
      {role === "ADMIN" ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Create project</h2>
          <p className="text-sm text-zinc-500">Spin up a new workspace for your team.</p>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-zinc-700">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Product launch"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
                placeholder="What is this project about?"
              />
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 md:w-auto"
            >
              {saving ? "Creating..." : "Create project"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Projects</h2>
            <p className="text-sm text-zinc-500">Browse the workspaces you have access to.</p>
          </div>
          <form onSubmit={handleSearch} className="flex w-full gap-2 md:w-auto">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Search projects"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
            >
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`project-skeleton-${index}`} className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {!loading && !error && projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            No projects yet. Ask an admin to create one for you.
          </div>
        ) : null}

        {!loading && !error && projects.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-zinc-900">{project.title}</h3>
                    <span className="text-xs text-zinc-400">
                      {project.members.length} member{project.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    {project.description || "No description provided yet."}
                  </p>
                </Link>
              ))}
            </div>
            {nextCursor ? (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-60"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
