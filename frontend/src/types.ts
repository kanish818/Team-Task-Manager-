export type Role = "ADMIN" | "MEMBER";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type User = {
  id: string;
  name: string;
  email: string;
};

export type ProjectMember = {
  id: string;
  role: Role;
  user: User;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedToId?: string | null;
  assignee?: User | null;
  creator: User;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  members: ProjectMember[];
  tasks?: Task[];
  taskCount?: number;
  completedCount?: number;
};

export type DashboardSummary = {
  total: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
};
