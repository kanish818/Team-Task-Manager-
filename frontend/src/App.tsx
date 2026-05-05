import type { FormEvent, JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCheck,
  CircleAlert,
  Clock3,
  LogOut,
  Plus,
  UserPlus,
} from "lucide-react";
import { ApiError, apiRequest } from "./api";
import type {
  DashboardSummary,
  Project,
  ProjectMember,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from "./types";

type AuthResponse = {
  token: string;
  user: User;
};

type ProjectListResponse = {
  projects: Project[];
};

type ProjectDetailResponse = {
  project: Project & { tasks: Task[]; members: ProjectMember[] };
};

type DashboardResponse = {
  summary: DashboardSummary;
  myTasks: (Task & { project: { id: string; name: string } })[];
};

const initialSummary: DashboardSummary = {
  total: 0,
  todo: 0,
  inProgress: 0,
  done: 0,
  overdue: 0,
};

const statusOptions: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];
const priorityOptions: TaskPriority[] = ["LOW", "MEDIUM", "HIGH"];

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("ethara-token"));
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ProjectDetailResponse["project"] | null>(null);
  const [summary, setSummary] = useState<DashboardSummary>(initialSummary);
  const [myTasks, setMyTasks] = useState<DashboardResponse["myTasks"]>([]);
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
  });

  const [memberForm, setMemberForm] = useState({
    email: "",
    role: "MEMBER" as Role,
  });

  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM" as TaskPriority,
    assignedToId: "",
  });

  const selectedMembers = useMemo(() => selectedProject?.members ?? [], [selectedProject]);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setProjects([]);
      setSelectedProjectId(null);
      setSelectedProject(null);
      setSummary(initialSummary);
      setMyTasks([]);
      return;
    }

    void bootstrapApp();
  }, [token]);

  useEffect(() => {
    if (!token || !selectedProjectId) {
      return;
    }

    void Promise.all([loadProject(selectedProjectId, token), loadDashboard(selectedProjectId, token)]);
  }, [selectedProjectId]);

  async function bootstrapApp() {
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [{ user: currentUser }, { projects: projectItems }] = await Promise.all([
        apiRequest<{ user: User }>("/auth/me", { token }),
        apiRequest<ProjectListResponse>("/projects", { token }),
      ]);

      setUser(currentUser);
      setProjects(projectItems);

      const projectToSelect = selectedProjectId ?? projectItems[0]?.id ?? null;
      setSelectedProjectId(projectToSelect);

      if (projectToSelect) {
        await Promise.all([loadProject(projectToSelect, token), loadDashboard(projectToSelect, token)]);
      } else {
        await loadDashboard(undefined, token);
      }
    } catch (caught) {
      handleError(caught, "Unable to load account");
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function loadProjects(activeToken = token) {
    if (!activeToken) {
      return;
    }

    const { projects: projectItems } = await apiRequest<ProjectListResponse>("/projects", {
      token: activeToken,
    });

    setProjects(projectItems);
    if (!projectItems.find((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projectItems[0]?.id ?? null);
    }
  }

  async function loadProject(projectId: string, activeToken = token) {
    if (!activeToken) {
      return;
    }

    const { project } = await apiRequest<ProjectDetailResponse>(`/projects/${projectId}`, {
      token: activeToken,
    });

    setSelectedProject(project);
  }

  async function loadDashboard(projectId?: string, activeToken = token) {
    if (!activeToken) {
      return;
    }

    const query = projectId ? `?projectId=${projectId}` : "";
    const { summary: nextSummary, myTasks: nextMyTasks } = await apiRequest<DashboardResponse>(
      `/projects/dashboard/summary${query}`,
      { token: activeToken },
    );

    setSummary(nextSummary);
    setMyTasks(nextMyTasks);
  }

  function handleError(caught: unknown, fallback: string) {
    const nextMessage = caught instanceof ApiError ? caught.message : fallback;
    setError(nextMessage);
    setMessage("");
  }

  function persistSession(nextToken: string, nextUser: User) {
    localStorage.setItem("ethara-token", nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem("ethara-token");
    setToken(null);
    setUser(null);
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const endpoint = authMode === "signup" ? "/auth/signup" : "/auth/login";
    const body =
      authMode === "signup"
        ? authForm
        : {
            email: authForm.email,
            password: authForm.password,
          };

    try {
      const response = await apiRequest<AuthResponse>(endpoint, {
        method: "POST",
        body,
      });

      persistSession(response.token, response.user);
      setAuthForm({ name: "", email: "", password: "" });
      setMessage(authMode === "signup" ? "Account created successfully" : "Welcome back");
    } catch (caught) {
      handleError(caught, "Unable to authenticate");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { project } = await apiRequest<{ project: Project }>("/projects", {
        method: "POST",
        token,
        body: projectForm,
      });

      setProjectForm({ name: "", description: "" });
      setSelectedProjectId(project.id);
      setMessage("Project created");
      await loadProjects();
      await Promise.all([loadProject(project.id), loadDashboard(project.id)]);
    } catch (caught) {
      handleError(caught, "Unable to create project");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest(`/projects/${selectedProjectId}/members`, {
        method: "POST",
        token,
        body: memberForm,
      });

      setMemberForm({ email: "", role: "MEMBER" });
      setMessage("Member added to project");
      await Promise.all([loadProject(selectedProjectId), loadProjects()]);
    } catch (caught) {
      handleError(caught, "Unable to add member");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedProjectId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await apiRequest(`/projects/${selectedProjectId}/tasks`, {
        method: "POST",
        token,
        body: {
          ...taskForm,
          assignedToId: taskForm.assignedToId || null,
          dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : null,
        },
      });

      setTaskForm({
        title: "",
        description: "",
        dueDate: "",
        priority: "MEDIUM",
        assignedToId: "",
      });
      setMessage("Task created");
      await Promise.all([loadProject(selectedProjectId), loadProjects(), loadDashboard(selectedProjectId)]);
    } catch (caught) {
      handleError(caught, "Unable to create task");
    } finally {
      setLoading(false);
    }
  }

  async function handleTaskUpdate(
    taskId: string,
    updates: Partial<Pick<Task, "status" | "priority" | "assignedToId">>,
  ) {
    if (!token || !selectedProjectId) {
      return;
    }

    setError("");

    try {
      await apiRequest(`/projects/tasks/${taskId}`, {
        method: "PATCH",
        token,
        body: updates,
      });

      await Promise.all([loadProject(selectedProjectId), loadProjects(), loadDashboard(selectedProjectId)]);
    } catch (caught) {
      handleError(caught, "Unable to update task");
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!token || !selectedProjectId) {
      return;
    }

    setError("");

    try {
      await apiRequest(`/projects/tasks/${taskId}`, {
        method: "DELETE",
        token,
      });

      setMessage("Task deleted");
      await Promise.all([loadProject(selectedProjectId), loadProjects(), loadDashboard(selectedProjectId)]);
    } catch (caught) {
      handleError(caught, "Unable to delete task");
    }
  }

  async function handleRoleChange(memberId: string, role: Role) {
    if (!token || !selectedProjectId) {
      return;
    }

    try {
      await apiRequest(`/projects/${selectedProjectId}/members/${memberId}`, {
        method: "PATCH",
        token,
        body: { role },
      });

      setMessage("Member role updated");
      await Promise.all([loadProject(selectedProjectId), loadProjects()]);
    } catch (caught) {
      handleError(caught, "Unable to update member role");
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!token || !selectedProjectId) {
      return;
    }

    try {
      await apiRequest(`/projects/${selectedProjectId}/members/${memberId}`, {
        method: "DELETE",
        token,
      });

      setMessage("Member removed");
      await Promise.all([loadProject(selectedProjectId), loadProjects()]);
    } catch (caught) {
      handleError(caught, "Unable to remove member");
    }
  }

  if (!token || !user) {
    return (
      <div className="page auth-page">
        <div className="ambient ambient-left" />
        <div className="ambient ambient-right" />
        <section className="auth-hero">
          <span className="eyebrow">Ethara Workspace</span>
          <h1>Structure projects, delegate tasks, and keep every deadline visible.</h1>
          <p>
            A Railway-ready team task manager with role-based access, live dashboard metrics,
            and a calmer visual system than the usual noisy admin panel.
          </p>
          <div className="hero-metrics">
            <div>
              <strong>Admin / Member</strong>
              <span>Project-level role control</span>
            </div>
            <div>
              <strong>Tasks + Dashboard</strong>
              <span>Status, overdue, and personal workload</span>
            </div>
          </div>
        </section>

        <section className="auth-card panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Secure Access</span>
              <h2>{authMode === "signup" ? "Create your account" : "Sign in to continue"}</h2>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="stack-form">
            {authMode === "signup" ? (
              <label>
                <span>Full name</span>
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Kanish Sharma"
                  required
                />
              </label>
            ) : null}

            <label>
              <span>Email</span>
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              <span>Password</span>
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="At least 8 characters"
                required
              />
            </label>

            <button className="primary-button" disabled={loading} type="submit">
              <span>{loading ? "Please wait..." : authMode === "signup" ? "Start workspace" : "Enter dashboard"}</span>
              <ArrowRight size={18} />
            </button>
          </form>

          <button
            className="text-button"
            onClick={() => setAuthMode((current) => (current === "signup" ? "login" : "signup"))}
            type="button"
          >
            {authMode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>

          {error ? <p className="feedback error">{error}</p> : null}
          {message ? <p className="feedback success">{message}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page app-page">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <aside className="sidebar panel">
        <div className="sidebar-header">
          <div>
            <span className="eyebrow">Ethara Control</span>
            <h2>{user.name}</h2>
          </div>
          <button className="icon-button" onClick={logout} title="Log out" type="button">
            <LogOut size={18} />
          </button>
        </div>

        <div className="sidebar-section">
          <div className="section-title">
            <BriefcaseBusiness size={18} />
            <span>Projects</span>
          </div>

          <div className="project-list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`project-pill ${selectedProjectId === project.id ? "active" : ""}`}
                onClick={() => setSelectedProjectId(project.id)}
                type="button"
              >
                <strong>{project.name}</strong>
                <span>
                  {project.completedCount ?? 0}/{project.taskCount ?? 0} tasks done
                </span>
              </button>
            ))}
          </div>
        </div>

        <form className="stack-form compact-form" onSubmit={handleCreateProject}>
          <div className="section-title">
            <Plus size={18} />
            <span>Create project</span>
          </div>
          <label>
            <span>Name</span>
            <input
              value={projectForm.name}
              onChange={(event) => setProjectForm((current) => ({ ...current, name: event.target.value }))}
              placeholder="Product launch"
              required
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              value={projectForm.description}
              onChange={(event) =>
                setProjectForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Short project context"
              rows={3}
            />
          </label>
          <button className="primary-button" disabled={loading} type="submit">
            <span>Add Project</span>
            <Plus size={18} />
          </button>
        </form>
      </aside>

      <main className="content">
        <section className="hero-strip panel dark-panel">
          <div>
            <span className="eyebrow">Team Task Manager</span>
            <h1>{selectedProject?.name ?? "Create your first project"}</h1>
            <p>
              {selectedProject?.description ??
                "Set up a project, add your team, and track progress from one place."}
            </p>
          </div>
          <div className="hero-stats">
            <MetricCard label="Total tasks" value={summary.total} icon={<BriefcaseBusiness size={18} />} />
            <MetricCard label="In progress" value={summary.inProgress} icon={<Clock3 size={18} />} />
            <MetricCard label="Overdue" value={summary.overdue} icon={<CircleAlert size={18} />} />
            <MetricCard label="Done" value={summary.done} icon={<CheckCheck size={18} />} />
          </div>
        </section>

        {error ? <p className="feedback error">{error}</p> : null}
        {message ? <p className="feedback success">{message}</p> : null}

        <section className="dashboard-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Your workload</span>
                <h2>Assigned tasks</h2>
              </div>
            </div>

            <div className="workload-list">
              {myTasks.length === 0 ? (
                <p className="empty-state">No tasks assigned to you yet.</p>
              ) : (
                myTasks.slice(0, 6).map((task) => (
                  <article className="workload-item" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.project.name}</span>
                    </div>
                    <span className={`status-chip ${task.status.toLowerCase().replace("_", "-")}`}>
                      {formatStatus(task.status)}
                    </span>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <span className="eyebrow">Team access</span>
                <h2>Members</h2>
              </div>
            </div>

            {selectedProject ? (
              <>
                <form className="stack-form compact-form inline-form" onSubmit={handleAddMember}>
                  <label>
                    <span>User email</span>
                    <input
                      type="email"
                      value={memberForm.email}
                      onChange={(event) => setMemberForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="member@example.com"
                      required
                    />
                  </label>
                  <label>
                    <span>Role</span>
                    <select
                      value={memberForm.role}
                      onChange={(event) =>
                        setMemberForm((current) => ({
                          ...current,
                          role: event.target.value as Role,
                        }))
                      }
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  <button className="secondary-button" type="submit">
                    <UserPlus size={16} />
                    <span>Add</span>
                  </button>
                </form>

                <div className="member-list">
                  {selectedProject.members.map((member) => (
                    <article className="member-item" key={member.id}>
                      <div>
                        <strong>{member.user.name}</strong>
                        <span>{member.user.email}</span>
                      </div>
                      <div className="member-actions">
                        <select
                          value={member.role}
                          onChange={(event) => handleRoleChange(member.id, event.target.value as Role)}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="MEMBER">Member</option>
                        </select>
                        <button className="ghost-button" onClick={() => handleRemoveMember(member.id)} type="button">
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <p className="empty-state">Select a project to manage team access.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <span className="eyebrow">Execution board</span>
              <h2>Create and track tasks</h2>
            </div>
          </div>

          {selectedProject ? (
            <>
              <form className="task-form" onSubmit={handleCreateTask}>
                <label>
                  <span>Task title</span>
                  <input
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Design review deck"
                    required
                  />
                </label>
                <label>
                  <span>Description</span>
                  <textarea
                    value={taskForm.description}
                    onChange={(event) =>
                      setTaskForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="What needs to happen?"
                    rows={3}
                  />
                </label>
                <label>
                  <span>Assign to</span>
                  <select
                    value={taskForm.assignedToId}
                    onChange={(event) => setTaskForm((current) => ({ ...current, assignedToId: event.target.value }))}
                  >
                    <option value="">Unassigned</option>
                    {selectedMembers.map((member) => (
                      <option key={member.user.id} value={member.user.id}>
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Priority</span>
                  <select
                    value={taskForm.priority}
                    onChange={(event) =>
                      setTaskForm((current) => ({
                        ...current,
                        priority: event.target.value as TaskPriority,
                      }))
                    }
                  >
                    {priorityOptions.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatLabel(priority)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="datetime-local"
                    value={taskForm.dueDate}
                    onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}
                  />
                </label>
                <button className="primary-button" disabled={loading} type="submit">
                  <span>Create Task</span>
                  <Plus size={18} />
                </button>
              </form>

              <div className="task-table">
                <div className="task-table-head">
                  <span>Task</span>
                  <span>Status</span>
                  <span>Priority</span>
                  <span>Assignee</span>
                  <span>Due</span>
                  <span>Action</span>
                </div>

                {(selectedProject.tasks ?? []).map((task) => (
                  <div className="task-row" key={task.id}>
                    <div>
                      <strong>{task.title}</strong>
                      <p>{task.description || "No description provided."}</p>
                    </div>
                    <select
                      value={task.status}
                      onChange={(event) =>
                        handleTaskUpdate(task.id, { status: event.target.value as TaskStatus })
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {formatStatus(status)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={task.priority}
                      onChange={(event) =>
                        handleTaskUpdate(task.id, { priority: event.target.value as TaskPriority })
                      }
                    >
                      {priorityOptions.map((priority) => (
                        <option key={priority} value={priority}>
                          {formatLabel(priority)}
                        </option>
                      ))}
                    </select>
                    <select
                      value={task.assignee?.id ?? ""}
                      onChange={(event) =>
                        handleTaskUpdate(task.id, {
                          assignedToId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">Unassigned</option>
                      {selectedMembers.map((member) => (
                        <option key={member.user.id} value={member.user.id}>
                          {member.user.name}
                        </option>
                      ))}
                    </select>
                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleString() : "No due date"}</span>
                    <button className="ghost-button" onClick={() => handleDeleteTask(task.id)} type="button">
                      Delete
                    </button>
                  </div>
                ))}
              </div>

              {(selectedProject.tasks ?? []).length === 0 ? (
                <p className="empty-state">No tasks yet. Create one to start tracking progress.</p>
              ) : null}
            </>
          ) : (
            <p className="empty-state">Create or select a project to start adding tasks.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: JSX.Element; label: string; value: number }) {
  return (
    <article className="metric-card">
      <div className="metric-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function formatStatus(status: TaskStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((item) => item[0]!.toUpperCase() + item.slice(1))
    .join(" ");
}

function formatLabel(value: string) {
  return value[0]!.toUpperCase() + value.slice(1).toLowerCase();
}

export default App;
