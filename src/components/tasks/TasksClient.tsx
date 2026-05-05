"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { formatDate } from "@/lib/format";

const statusOptions = ["TODO", "IN_PROGRESS", "COMPLETED"] as const;
const priorityOptions = ["LOW", "MEDIUM", "HIGH"] as const;

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedToId: string | null;
  projectId: string;
  createdById: string;
};

type ProjectItem = {
  id: string;
  title: string;
};

type Role = "ADMIN" | "MEMBER";

type TasksClientProps = {
  role: Role;
  userId: string;
};

type TaskDraft = {
  status: string;
  priority: string;
  dueDate: string;
  assignedToId: string;
};

export default function TasksClient({ role, userId }: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("");
  const [assignee, setAssignee] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, TaskDraft>>({});
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);

  const fetchData = useCallback(async (withLoading: boolean, cursor?: string) => {
    if (withLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (projectFilter) params.set("projectId", projectFilter);
      if (overdueOnly) params.set("overdue", "true");
      if (cursor) params.set("cursor", cursor);
      const url = params.toString() ? `/api/tasks?${params.toString()}` : "/api/tasks";

      const [tasksResponse, projectsResponse] = await Promise.all([
        fetch(url),
        role === "ADMIN" ? fetch("/api/projects") : Promise.resolve(null),
      ]);

      if (!tasksResponse.ok) {
        const payload = await tasksResponse.json();
        throw new Error(payload?.error ?? "Failed to load tasks");
      }

      const tasksPayload = await tasksResponse.json();
      if (cursor) {
        setTasks((prev) => [...prev, ...(tasksPayload.tasks ?? [])]);
      } else {
        setTasks(tasksPayload.tasks ?? []);
      }
      setNextCursor(tasksPayload.nextCursor ?? null);

      if (projectsResponse) {
        const projectsPayload = projectsResponse.ok ? await projectsResponse.json() : { projects: [] };
        setProjects(projectsPayload.projects ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [overdueOnly, priorityFilter, projectFilter, query, role, statusFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!active) return;
      await fetchData(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [fetchData]);

  const projectOptions = useMemo(() => projects, [projects]);

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!title.trim()) {
      setFormError("Task title is required.");
      return;
    }
    if (!projectId) {
      setFormError("Select a project.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          projectId,
          assignedToId: assignee.trim() || undefined,
          priority,
          dueDate: dueDate || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to create task");
      }

      setTitle("");
      setDescription("");
      setAssignee("");
      setPriority("MEDIUM");
      setDueDate("");
      await fetchData(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await fetchData(true);
  };

  const handleLoadMore = async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    await fetchData(false, nextCursor);
    setLoadingMore(false);
  };

  const ensureDraft = (task: TaskItem): TaskDraft => {
    return (
      drafts[task.id] ?? {
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        assignedToId: task.assignedToId ?? "",
      }
    );
  };

  const updateDraft = (taskId: string, patch: Partial<TaskDraft>) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) return;
    setDrafts((prev) => ({
      ...prev,
      [taskId]: { ...ensureDraft(target), ...patch },
    }));
  };

  const saveTask = async (task: TaskItem) => {
    setSavingTaskId(task.id);
    setError(null);

    const draft = ensureDraft(task);

    const payload: Record<string, string | null> = {
      status: draft.status,
    };

    if (role === "ADMIN") {
      payload.priority = draft.priority;
      payload.dueDate = draft.dueDate || null;
      payload.assignedToId = draft.assignedToId || null;
    }

    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const resPayload = await response.json();
        throw new Error(resPayload?.error ?? "Unable to update task");
      }

      await fetchData(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSavingTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={`task-skeleton-${index}`} className="h-36 animate-pulse rounded-2xl bg-zinc-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {role === "ADMIN" ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Create task</h2>
          <p className="text-sm text-zinc-500">Assign tasks to teammates and set priorities.</p>
          <form onSubmit={handleCreateTask} className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700">Title</label>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                placeholder="Write release notes"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Project</label>
              <select
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="">Select a project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-700">Assignee user ID</label>
              <input
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                placeholder="user-id"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-zinc-700">Priority</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                >
                  {priorityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-zinc-700">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-zinc-700">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                rows={3}
              />
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60 md:w-auto"
            >
              {saving ? "Creating..." : "Create task"}
            </button>
          </form>
        </section>
      ) : null}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Tasks</h2>
            <p className="text-sm text-zinc-500">
              {role === "ADMIN"
                ? "Manage all tasks across projects."
                : "Update the status of tasks assigned to you."}
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="text-xs font-medium text-zinc-500">Search</label>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
              placeholder="Search tasks"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Status</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500">Priority</label>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
            >
              <option value="">All</option>
              {priorityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {role === "ADMIN" ? (
            <div>
              <label className="text-xs font-medium text-zinc-500">Project</label>
              <select
                value={projectFilter}
                onChange={(event) => setProjectFilter(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-2 text-sm"
              >
                <option value="">All</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(event) => setOverdueOnly(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <label className="text-xs font-medium text-zinc-500">Overdue only</label>
          </div>
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Apply
          </button>
        </form>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {tasks.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
            No tasks yet. Ask an admin to assign you one.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
            {tasks.map((task) => {
              const draft = ensureDraft(task);
              const canEdit = role === "ADMIN" || task.assignedToId === userId;

              return (
                <div key={task.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-900">{task.title}</h3>
                      <p className="text-xs text-zinc-500">Due {formatDate(task.dueDate)}</p>
                    </div>
                    <span className="text-xs text-zinc-400">{task.projectId}</span>
                  </div>
                  {task.description ? (
                    <p className="mt-2 text-sm text-zinc-600">{task.description}</p>
                  ) : null}

                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="text-xs font-medium text-zinc-500">Status</label>
                      <select
                        value={draft.status}
                        onChange={(event) => updateDraft(task.id, { status: event.target.value })}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                        disabled={!canEdit}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>

                    {role === "ADMIN" ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-zinc-500">Priority</label>
                          <select
                            value={draft.priority}
                            onChange={(event) => updateDraft(task.id, { priority: event.target.value })}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                          >
                            {priorityOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-medium text-zinc-500">Due date</label>
                          <input
                            type="date"
                            value={draft.dueDate}
                            onChange={(event) => updateDraft(task.id, { dueDate: event.target.value })}
                            className="rounded-md border border-zinc-200 px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-2 md:col-span-2">
                          <label className="text-xs font-medium text-zinc-500">Assignee</label>
                          <input
                            value={draft.assignedToId}
                            onChange={(event) => updateDraft(task.id, { assignedToId: event.target.value })}
                            className="w-full rounded-md border border-zinc-200 px-2 py-1 text-xs"
                            placeholder="user-id"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => saveTask(task)}
                    disabled={!canEdit || savingTaskId === task.id}
                    className="mt-4 rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {savingTaskId === task.id ? "Saving..." : "Save changes"}
                  </button>
                </div>
              );
            })}
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
        )}
      </section>
    </div>
  );
}
