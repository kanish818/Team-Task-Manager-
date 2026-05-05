"use client";

import { useEffect, useState } from "react";
import StatCard from "@/components/ui/StatCard";

type DashboardTotals = {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  userTasks: number;
};

type ProjectCompletion = {
  projectId: string;
  title: string;
  totalTasks: number;
  completedTasks: number;
  progressPercent: number;
};

type DashboardResponse = {
  totals: DashboardTotals;
  projectCompletion: ProjectCompletion[];
};

export default function DashboardClient() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload?.error ?? "Failed to load dashboard");
        }
        const payload = (await response.json()) as DashboardResponse;
        if (active) setData(payload);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unexpected error");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="h-28 animate-pulse rounded-2xl bg-zinc-100"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-zinc-500">No dashboard data yet.</p>;
  }

  const { totals, projectCompletion } = data;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Tasks" value={totals.totalTasks} />
        <StatCard label="Completed" value={totals.completedTasks} />
        <StatCard label="In Progress" value={totals.inProgressTasks} />
        <StatCard label="Pending" value={totals.pendingTasks ?? 0} />
        <StatCard label="Overdue" value={totals.overdueTasks} />
        <StatCard label="Your Tasks" value={totals.userTasks} />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Project Progress</h2>
            <p className="text-sm text-zinc-500">
              Completion rate across projects you can access.
            </p>
          </div>
        </div>

        {projectCompletion.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            No projects yet. Create a project to start tracking progress.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {projectCompletion.map((project) => (
              <div key={project.projectId} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{project.title}</p>
                    <p className="text-xs text-zinc-500">
                      {project.completedTasks}/{project.totalTasks} tasks completed
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-900">
                    {project.progressPercent}%
                  </span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-zinc-900"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
