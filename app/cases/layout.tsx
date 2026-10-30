import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";

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
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Navbar user={session} />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}

