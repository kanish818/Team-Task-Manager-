import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import TasksClient from "@/components/tasks/TasksClient";

export default async function TasksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      role={session.user.role}
    >
      <TasksClient role={session.user.role} userId={session.user.id} />
    </AppShell>
  );
}
