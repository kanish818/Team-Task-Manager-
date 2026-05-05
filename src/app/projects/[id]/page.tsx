import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";
import ProjectDetailClient from "@/components/projects/ProjectDetailClient";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProjectDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <AppShell
      userName={session.user.name ?? session.user.email ?? "User"}
      role={session.user.role}
    >
      <ProjectDetailClient projectId={id} role={session.user.role} />
    </AppShell>
  );
}
