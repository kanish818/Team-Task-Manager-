import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ProjectsClient from "@/components/projects/ProjectsClient";

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      role={session.user.role}
    >
      <ProjectsClient role={session.user.role} />
    </AppShell>
  );
}
