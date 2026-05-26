"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Home, Users, BookOpen, Building2, Calendar,
  ClipboardList, BarChart2, Clock, Star, LogOut,
  GraduationCap, Settings, Info, ChevronLeft, ChevronRight,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NavItem = { label: string; href: string; icon: React.ReactNode };

const NAV_ITEMS: Record<string, NavItem[]> = {
  admin: [
    { label: "Inicio", href: "/admin", icon: <Home className="h-4 w-4" /> },
    { label: "Docentes", href: "/admin/docentes", icon: <Users className="h-4 w-4" /> },
    { label: "Cursos", href: "/admin/cursos", icon: <BookOpen className="h-4 w-4" /> },
    { label: "Aulas", href: "/admin/aulas", icon: <Building2 className="h-4 w-4" /> },
    { label: "Usuarios", href: "/admin/usuarios", icon: <Settings className="h-4 w-4" /> },
  ],
  director_escuela: [
    { label: "Inicio", href: "/director-escuela", icon: <Home className="h-4 w-4" /> },
    { label: "Cursos del Semestre", href: "/director-escuela/cursos", icon: <BookOpen className="h-4 w-4" /> },
    { label: "Aulas Disponibles", href: "/director-escuela/aulas", icon: <Building2 className="h-4 w-4" /> },
    { label: "Generar Horario", href: "/director-escuela/generar", icon: <Calendar className="h-4 w-4" /> },
  ],
  director_depto: [
    { label: "Inicio", href: "/director-depto", icon: <Home className="h-4 w-4" /> },
    { label: "Asignar Cursos", href: "/director-depto/asignaciones", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Resumen de Cargas", href: "/director-depto/cargas", icon: <BarChart2 className="h-4 w-4" /> },
  ],
  docente: [
    { label: "Inicio", href: "/docente", icon: <Home className="h-4 w-4" /> },
    { label: "Mi Disponibilidad", href: "/docente/disponibilidad", icon: <Clock className="h-4 w-4" /> },
    { label: "Mis Preferencias", href: "/docente/preferencias", icon: <Star className="h-4 w-4" /> },
    { label: "Mis Cursos", href: "/docente/cursos", icon: <BookOpen className="h-4 w-4" /> },
    { label: "Mi Horario", href: "/docente/horario", icon: <Calendar className="h-4 w-4" /> },
    { label: "Recuperación", href: "/docente/recuperacion", icon: <BookMarked className="h-4 w-4" /> },
  ],
};

const ROLE_LABELS: Record<string, string> = {
  admin: "ADMINISTRADOR",
  director_escuela: "DIRECTOR DE ESCUELA",
  director_depto: "DIRECTOR DE DEPARTAMENTO",
  docente: "DOCENTE",
};

interface AppSidebarProps {
  role: string;
  userName: string;
}

export function AppSidebar({ role, userName }: AppSidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[role] ?? [];
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col min-h-screen bg-[#111827] text-white transition-all duration-300 ease-in-out relative border-r border-slate-800",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Logo Header */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-800">
        <div className="flex-shrink-0 bg-[#0052cc] rounded-xl p-2 shadow-md shadow-blue-900/10">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="leading-tight animate-fade-in">
            <p className="text-base font-bold tracking-tight text-white">Horarios UNT</p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-widest mt-0.5">ING. DE SISTEMAS</p>
          </div>
        )}
      </div>

      {/* Collapse Trigger Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-[26px] h-6 w-6 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-750 p-0 flex items-center justify-center text-slate-300 transition-all z-20 shadow-sm"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-hidden">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
                active
                  ? "bg-[#0052cc] text-white shadow-md shadow-blue-900/10"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              )}
            >
              <span className={cn("flex-shrink-0", active ? "text-white" : "text-slate-400")}>{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* About System Section */}
      <div className="px-3 pb-2 border-t border-slate-800 pt-3">
        <Link
          href="/acerca"
          className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
            pathname === "/acerca"
              ? "bg-[#0052cc] text-white"
              : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
          )}
        >
          <Info className="h-4 w-4 flex-shrink-0" />
          {!collapsed && <span className="truncate">Acerca del Sistema</span>}
        </Link>
      </div>

      {/* User Profile Footer */}
      <div className="border-t border-slate-800 px-4 py-5 space-y-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="h-10 w-10 rounded-full bg-[#0052cc] border border-blue-400/20 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
            {userName.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 animate-fade-in leading-tight">
              <p className="text-sm font-semibold text-white truncate">{userName}</p>
              <p className="text-[9px] text-slate-400 font-bold tracking-wider mt-0.5 truncate">
                {ROLE_LABELS[role] ?? role}
              </p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800/60 px-3 py-2 rounded-xl text-sm font-medium",
            collapsed && "justify-center px-0"
          )}
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </div>
    </aside>
  );
}