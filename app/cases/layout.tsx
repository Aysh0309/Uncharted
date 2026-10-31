import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export const dynamic = "force-dynamic";

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <AppSidebar user={session} />
      <AppHeader user={session} />
      <main className="lg:pl-72 pt-16 min-h-screen bg-surface flex flex-col">
        {children}
      </main>
    </div>
  );
}
