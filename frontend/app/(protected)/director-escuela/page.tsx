import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, Clock, Circle, Calendar, BookOpen, Building2,
  ArrowRight, Sparkles, Plus, Rocket, BarChart4
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getSemestreActivo(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/semestres/activo`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DirectorEscuelaDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const semestre = await getSemestreActivo(session.user.access_token);

  // Replicating exactly the data in the screenshot
  const codigoSemestre = semestre?.codigo ?? "2026-I";
  const fechaInicio = semestre?.fecha_inicio ? new Date(semestre.fecha_inicio).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }) : "12 de abril de 2026";
  const fechaFin = semestre?.fecha_fin ? new Date(semestre.fecha_fin).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }) : "7 de agosto de 2026";

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Dashboard Director de Escuela
        </h1>
      </div>

      {/* Semestre Activo Banner */}
      <Card className="border-gray-200/80 bg-blue-50/10 shadow-sm rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0052cc] tracking-wider uppercase">
            <Calendar className="h-4 w-4" />
            Semestre Activo
          </div>
          <h2 className="text-4xl font-extrabold text-gray-950 tracking-tight">
            {codigoSemestre}
          </h2>
          <p className="text-sm text-gray-500 font-medium">
            {fechaInicio} — {fechaFin}
          </p>
        </div>
        <div className="bg-slate-50 border border-gray-150 rounded-xl px-6 py-4 flex flex-col min-w-[220px]">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Estado Actual</span>
          <span className="text-lg font-bold text-[#0052cc] mt-1">Asignando docentes</span>
        </div>
      </Card>

      {/* Process Status Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Estado del proceso</h3>
          <span className="text-sm font-semibold text-[#0052cc]">60% completado</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Phase 1 */}
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Fase 1</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-gray-900">Apertura del semestre</p>
          </div>

          {/* Phase 2 */}
          <div className="bg-emerald-50/30 border border-emerald-100 rounded-xl p-4 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-emerald-700 font-bold uppercase">Fase 2</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <p className="text-sm font-bold text-gray-900">Declaración disponibilidad</p>
          </div>

          {/* Phase 3 */}
          <div className="bg-blue-50/30 border-2 border-[#0052cc] rounded-xl p-4 space-y-3 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#0052cc] font-bold uppercase">Fase 3</span>
              <div className="h-2.5 w-2.5 rounded-full bg-[#0052cc]" />
            </div>
            <p className="text-sm font-bold text-[#0052cc]">Asignación curso-docente</p>
          </div>

          {/* Phase 4 */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 space-y-3 flex flex-col justify-between opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Fase 4</span>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-500">Generación de horario</p>
          </div>

          {/* Phase 5 */}
          <div className="bg-white border border-gray-200/80 rounded-xl p-4 space-y-3 flex flex-col justify-between opacity-70">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase">Fase 5</span>
              <Rocket className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm font-bold text-gray-500">Publicación</p>
          </div>
        </div>
      </div>

      {/* Grid of Action Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Generar Horario Block */}
        <div className="lg:col-span-5 bg-[#0052cc] hover:bg-[#0040a0] transition-colors text-white p-8 rounded-2xl flex flex-col justify-between space-y-8 shadow-md">
          <div className="space-y-4">
            <div className="rounded-xl bg-white/10 p-3 w-fit">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight">Generar Horario</h3>
            <p className="text-sm text-blue-100/90 leading-relaxed">
              Ejecutar motor automático con algoritmos greedy y backtracking para optimizar espacios.
            </p>
          </div>
          <Link href="/director-escuela/generar">
            <button className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider hover:underline w-fit">
              Comenzar Proceso
              <ArrowRight className="h-4 w-4" />
            </button>
          </Link>
        </div>

        {/* Cursos & Aulas Stack */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cursos del Semestre */}
            <Link href="/director-escuela/cursos" className="group block">
              <Card className="hover:shadow-md transition-all duration-300 border-gray-200/80 rounded-xl p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-blue-50 text-[#0052cc] p-2.5">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                    85% Revisado
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-[#0052cc] transition-colors">
                    Cursos del Semestre
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">42 secciones por asignar</p>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: "85%" }} />
                </div>
              </Card>
            </Link>

            {/* Aulas Disponibles */}
            <Link href="/director-escuela/aulas" className="group block">
              <Card className="hover:shadow-md transition-all duration-300 border-gray-200/80 rounded-xl p-5 flex flex-col justify-between h-full space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg bg-blue-50 text-[#0052cc] p-2.5">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold bg-blue-50 text-[#0052cc] px-2 py-0.5 rounded">
                    18 Disponibles
                  </span>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 group-hover:text-[#0052cc] transition-colors">
                    Aulas Disponibles
                  </h4>
                  <p className="text-xs text-gray-500 mt-1">Capacidad total: 850 alumnos</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {["A1", "A2", "L1", "+15"].map((badge) => (
                    <span key={badge} className="text-[10px] font-bold bg-slate-100 text-gray-600 px-2 py-0.5 rounded">
                      {badge}
                    </span>
                  ))}
                </div>
              </Card>
            </Link>
          </div>

          {/* Actividad Reciente Card */}
          <Card className="border-gray-200/80 rounded-xl p-6 space-y-4">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Actividad Reciente</span>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#0052cc] shrink-0" />
                  <p className="text-gray-600">
                    El docente <strong className="text-gray-900 font-semibold">Carlos Ruiz</strong> actualizó su disponibilidad horaria.
                  </p>
                </div>
                <span className="text-gray-400 shrink-0">Hace 10 min</span>
              </div>
              <div className="flex items-start justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#0052cc] shrink-0" />
                  <p className="text-gray-600">
                    Se habilitó el <strong className="text-gray-900 font-semibold">Laboratorio de Redes</strong> para el ciclo 2026-I.
                  </p>
                </div>
                <span className="text-gray-400 shrink-0">Hace 2 horas</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Proyección de Carga Section */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-6 relative space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 text-[#0052cc] p-2">
              <BarChart4 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">
              Proyección de Carga
            </h3>
          </div>
          <div className="flex items-center border border-gray-200 rounded-lg p-0.5 bg-slate-50 text-xs font-semibold">
            <button className="px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-800">Semanal</button>
            <button className="px-3 py-1.5 rounded-md bg-white text-gray-800 shadow-sm border border-gray-150">Ciclo Completo</button>
          </div>
        </div>

        {/* Mock bar chart with realistic heights */}
        <div className="flex items-end justify-between h-48 pt-4 border-b border-gray-200/80 px-4">
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-12 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Lun</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-32 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Mar</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-40 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Mie</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-24 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Jue</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-36 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Vie</span>
          </div>
          <div className="flex flex-col items-center gap-2 w-1/6">
            <div className="w-full bg-[#d3daef]/60 rounded-t-lg h-10 hover:bg-[#0052cc]/40 transition-colors" />
            <span className="text-[10px] font-bold text-gray-400 uppercase">Sab</span>
          </div>
        </div>

        {/* Floating action button matching the dashboard */}
        <button className="absolute -top-3 right-6 h-12 w-12 rounded-full bg-[#0052cc] hover:bg-[#0040a0] text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 z-10">
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}