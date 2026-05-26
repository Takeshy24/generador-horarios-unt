import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppSidebar } from "@/components/AppSidebar";
import { Bell, HelpCircle, ArrowUpFromLine } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const role = session.user.role;
  const userName = session.user.name ?? session.user.email ?? "Usuario";

  return (
    <div className="flex min-h-screen bg-slate-50/50">
      <AppSidebar role={role} userName={userName} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header exact replication */}
        <header className="bg-white border-b border-gray-200/80 px-8 py-4 sticky top-0 z-10 shadow-sm shadow-slate-100/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#0052cc] tracking-tight">
              Generador de Horarios UNT
            </h2>
            <div className="flex items-center gap-5">
              {/* Notification icon with red dot */}
              <button className="relative p-1.5 text-gray-500 hover:text-gray-800 hover:bg-slate-100 rounded-lg transition-colors">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
              </button>

              {/* Help Circle icon */}
              <button className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-slate-100 rounded-lg transition-colors">
                <HelpCircle className="h-5 w-5" />
              </button>

              {role === "director_escuela" && (
                <Button className="bg-[#0052cc] hover:bg-[#0040a0] text-white gap-2 h-10 px-4 rounded-lg font-medium shadow-sm">
                  <ArrowUpFromLine className="h-4 w-4" />
                  Publicar Horario
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
