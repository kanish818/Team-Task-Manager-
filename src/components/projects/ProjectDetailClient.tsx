"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";

type Role = "ADMIN" | "MEMBER";

const priorityOptions = ["LOW", "MEDIUM", "HIGH"] as const;

type ProjectDetail = {
  id: string;
  title: string;
  description: string | null;
  createdById: string;
  members: { id: string; userId: string }[];
};

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedToId: string | null;
  projectId: string;
};

type ProjectDetailClientProps = {
  projectId: string;
  role: Role;
};

export default function ProjectDetailClient({ projectId, role }: ProjectDetailClientProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memberId, setMemberId] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSaving, setMemberSaving] = useState(false);

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskPriority, setTaskPriority] = useState("MEDIUM");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskSaving, setTaskSaving] = useState(false);

  const loadProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectResponse, tasksResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}`),
        fetch("/api/tasks"),
      ]);

      if (!projectResponse.ok) {
        const payload = await projectResponse.json();
        throw new Error(payload?.error ?? "Failed to load project");
      }

      const projectPayload = await projectResponse.json();
      const tasksPayload = tasksResponse.ok ? await tasksResponse.json() : { tasks: [] };

      setProject(projectPayload.project);
      setTasks((tasksPayload.tasks ?? []).filter((task: TaskItem) => task.projectId === projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProject();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProject]);

  const handleAddMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMemberError(null);

    if (!memberId.trim()) {
      setMemberError("User ID is required.");
      return;
    }

    setMemberSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: memberId.trim() }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to add member");
      }

      setMemberId("");
      await loadProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setMemberSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setMemberError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to remove member");
      }
      await loadProject();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : "Unexpected error");
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTaskError(null);

    if (!taskTitle.trim()) {
      setTaskError("Task title is required.");
      return;
    }

    setTaskSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          projectId,
          assignedToId: taskAssignee.trim() || undefined,
          priority: taskPriority,
          dueDate: taskDueDate || undefined,
        }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload?.error ?? "Unable to create task");
      }

      setTaskTitle("");
      setTaskDescription("");
      setTaskAssignee("");
      setTaskDueDate("");
      await loadProject();
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setTaskSaving(false);
    }
  };

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-zinc-100" />;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!project) {
    return <p className="text-sm text-zinc-500">Project not found.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <Link className="text-sm text-zinc-500 hover:text-zinc-800" href="/projects">
          Back to projects
        </Link>
        <h2 className="mt-3 text-2xl font-semibold text-zinc-900">{project.title}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {project.description || "No description provided yet."}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-900">Tasks</h3>
            <span className="text-sm text-zinc-500">{tasks.length} total</span>
          </div>

          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500">
              No tasks yet for this project.
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{task.title}</p>
                      <p className="text-xs text-zinc-500">Due {formatDate(task.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span className="rounded-full bg-zinc-100 px-2 py-1">{task.status}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-1">{task.priority}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h4 className="text-base font-semibold text-zinc-900">Team members</h4>
            <p className="text-xs text-zinc-500">User IDs assigned to this project.</p>
            <ul className="mt-4 space-y-2">
              {project.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700">{member.userId}</span>
                  {role === "ADMIN" ? (
                    <button
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-xs text-red-600 hover:text-red-700"
                      type="button"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>

            {project.members.length === 0 ? (
              <p className="mt-3 text-xs text-zinc-500">No members yet.</p>
            ) : null}

            {role === "ADMIN" ? (
              <form onSubmit={handleAddMember} className="mt-4 space-y-2">
                <label className="text-xs font-medium text-zinc-600">Add member by user ID</label>
                <input
                  value={memberId}
                  onChange={(event) => setMemberId(event.target.value)}
                  className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                  placeholder="user-id"
                />
                {memberError ? <p className="text-xs text-red-600">{memberError}</p> : null}
                <button
                  type="submit"
                  disabled={memberSaving}
                  className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {memberSaving ? "Adding..." : "Add member"}
                </button>
              </form>
            ) : (
              <p className="mt-4 text-xs text-zinc-500">
                Ask an admin to add new members.
              </p>
            )}
          </div>

          {role === "ADMIN" ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <h4 className="text-base font-semibold text-zinc-900">Create task</h4>
              <form onSubmit={handleCreateTask} className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-zinc-600">Title</label>
                  <input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="Draft onboarding email"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">Description</label>
                  <textarea
                    value={taskDescription}
                    onChange={(event) => setTaskDescription(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-600">Assignee user ID</label>
                  <input
                    value={taskAssignee}
                    onChange={(event) => setTaskAssignee(event.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    placeholder="user-id"
                  />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Priority</label>
                    <select
                      value={taskPriority}
                      onChange={(event) => setTaskPriority(event.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-600">Due date</label>
                    <input
                      type="date"
                      value={taskDueDate}
                      onChange={(event) => setTaskDueDate(event.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                {taskError ? <p className="text-xs text-red-600">{taskError}</p> : null}
                <button
                  type="submit"
                  disabled={taskSaving}
                  className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                >
                  {taskSaving ? "Creating..." : "Create task"}
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
