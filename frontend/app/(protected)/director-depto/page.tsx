import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users, BookOpen, ClipboardList, ArrowRight, Plus, BarChart2,
  UserPlus, Award, Layers, Sparkles
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getStats(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/seed/summary`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function DirectorDeptoDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const stats = await getStats(session.user.access_token);

  // Fallbacks corresponding to the screenshot mock
  const componentesCount = stats?.componentes_a_programar ?? 117;
  const docentesCount = stats?.docentes ?? 20;
  const seccionesCount = stats?.secciones ?? 42;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Title block */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
          Dashboard Director de Departamento
        </h1>
        <p className="text-base text-gray-500 mt-1">
          Asignación de carga académica docente para el semestre 2026-I
        </p>
      </div>

      {/* 3 Premium Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Componentes Asignados */}
        <Card className="border-gray-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-blue-50 p-2 text-[#0052cc]">
              <BookOpen className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-500 tracking-tight">
              Componentes asignados
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-gray-950 tracking-tight">
              {componentesCount}
            </span>
            <span className="text-xs bg-blue-50 text-[#0052cc] font-semibold px-2 py-0.5 rounded-full">
              +5 vs sem. ant.
            </span>
          </CardContent>
        </Card>

        {/* Docentes Activos */}
        <Card className="border-gray-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-500 tracking-tight">
              Docentes activos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-gray-950 tracking-tight">
              {docentesCount}
            </span>
            <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">
              100% operativos
            </span>
          </CardContent>
        </Card>

        {/* Secciones del Semestre */}
        <Card className="border-gray-200/80 shadow-sm rounded-xl">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
            <CardTitle className="text-sm font-semibold text-gray-500 tracking-tight">
              Secciones del semestre
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-baseline gap-3">
            <span className="text-4xl font-extrabold text-gray-950 tracking-tight">
              {seccionesCount}
            </span>
            <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded-full">
              8 aulas req.
            </span>
          </CardContent>
        </Card>
      </div>

      {/* 2 Massive Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Asignar Cursos a Docentes */}
        <Link href="/director-depto/asignaciones" className="group block">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-gray-200/80 hover:border-blue-300/60 rounded-xl h-full p-6 space-y-4">
            <div className="rounded-xl bg-blue-50/80 text-[#0052cc] p-3 w-fit transition-transform group-hover:scale-105">
              <UserPlus className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#0052cc] transition-colors">
                Asignar Cursos a Docentes
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Selecciona docentes por prelación (nombrado → contratado, antigüedad descendente) para cada componente del semestre 2026-I.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#0052cc] pt-2">
              Comenzar proceso
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </div>
          </Card>
        </Link>

        {/* Resumen de Cargas */}
        <Link href="/director-depto/cargas" className="group block">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-gray-200/80 hover:border-blue-300/60 rounded-xl h-full p-6 space-y-4">
            <div className="rounded-xl bg-slate-150/60 text-slate-600 p-3 w-fit transition-transform group-hover:scale-105">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-900 group-hover:text-[#0052cc] transition-colors">
                Resumen de Cargas
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Visualiza la carga horaria lectiva de cada docente y su tope según régimen laboral. Exporta reportes para decanato.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 group-hover:text-[#0052cc] transition-colors pt-2">
              Ver estadísticas
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1.5" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Estado de Carga Horaria Table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden relative">
        <div className="px-6 py-5 border-b border-gray-150 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            Estado de Carga Horaria
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Filtrar por:</span>
            <select className="text-xs font-semibold bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 outline-none">
              <option>Todos los Docentes</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-gray-150">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Docente</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Régimen</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Horas / Límite</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado de carga</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {/* Row 1 */}
              <tr className="hover:bg-slate-50/40 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50/80 text-blue-600 font-bold flex items-center justify-center text-sm shadow-inner">
                    MA
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Abanto, Miguel</p>
                    <p className="text-xs text-gray-500">m.abanto@unt.edu.pe</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs bg-blue-50 text-[#0052cc] font-semibold px-2.5 py-1 rounded-full">
                    TC (Nombrado)
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  18 / 20 hrs
                </td>
                <td className="px-6 py-4">
                  <div className="w-full max-w-xs space-y-1.5">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0052cc] rounded-full" style={{ width: "90%" }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">90% completado</span>
                  </div>
                </td>
                <td className="px-6 py-4" />
              </tr>

              {/* Row 2 */}
              <tr className="hover:bg-slate-50/40 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm shadow-inner">
                    JR
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Rodríguez, Jorge</p>
                    <p className="text-xs text-gray-500">j.rodriquez@unt.edu.pe</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2.5 py-1 rounded-full">
                    TP (Contratado)
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  08 / 12 hrs
                </td>
                <td className="px-6 py-4">
                  <div className="w-full max-w-xs space-y-1.5">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#0052cc] rounded-full" style={{ width: "66%" }} />
                    </div>
                    <span className="text-xs text-gray-500 font-medium">66% completado</span>
                  </div>
                </td>
                <td className="px-6 py-4" />
              </tr>

              {/* Row 3 */}
              <tr className="hover:bg-slate-50/40 transition-colors">
                <td className="px-6 py-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-50 text-red-600 font-bold flex items-center justify-center text-sm shadow-inner">
                    LC
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Castillo, Lucía</p>
                    <p className="text-xs text-gray-500">l.castillo@unt.edu.pe</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs bg-blue-50 text-[#0052cc] font-semibold px-2.5 py-1 rounded-full">
                    DE (Nombrado)
                  </span>
                </td>
                <td className="px-6 py-4 font-semibold text-gray-900">
                  38 / 40 hrs
                </td>
                <td className="px-6 py-4">
                  <div className="w-full max-w-xs space-y-1.5">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: "95%" }} />
                    </div>
                    <span className="text-xs text-red-600 font-semibold">Cerca del límite (95%)</span>
                  </div>
                </td>
                <td className="px-6 py-4" />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Floating Plus Button replication */}
        <button className="absolute bottom-6 right-6 h-12 w-12 rounded-full bg-[#0052cc] hover:bg-[#0040a0] text-white flex items-center justify-center shadow-lg transition-all hover:scale-105">
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {/* Footer / preview section */}
      <div className="space-y-4 pt-4">
        <h3 className="text-base font-bold text-gray-500 tracking-tight uppercase">
          Vista Previa de Horario Generado (Borrador)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1 */}
          <div className="bg-slate-50/50 border-l-4 border-l-amber-500 border border-gray-200/80 rounded-r-xl p-4 space-y-2 shadow-sm">
            <p className="text-xs text-gray-400 font-semibold">07:00 - 09:00</p>
            <h4 className="text-sm font-bold text-gray-900">Sistemas Distribuidos</h4>
            <p className="text-xs text-gray-500">Aula 204 • B. Salas</p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-50/50 border-l-4 border-l-blue-500 border border-gray-200/80 rounded-r-xl p-4 space-y-2 shadow-sm">
            <p className="text-xs text-gray-400 font-semibold">09:00 - 11:00</p>
            <h4 className="text-sm font-bold text-gray-900">Gestión de Datos</h4>
            <p className="text-xs text-gray-500">Laboratorio C • J. Ruiz</p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-50/20 border-l-4 border-l-gray-300 border border-gray-200/50 rounded-r-xl p-4 space-y-2 shadow-sm opacity-60">
            <p className="text-xs text-gray-400 font-semibold">11:00 - 13:00</p>
            <h4 className="text-sm font-bold text-gray-400 italic">Hora de Coordinación</h4>
          </div>

          {/* Card 4 */}
          <div className="bg-slate-50/50 border-l-4 border-l-emerald-500 border border-gray-200/80 rounded-r-xl p-4 space-y-2 shadow-sm">
            <p className="text-xs text-gray-400 font-semibold">13:00 - 15:00</p>
            <h4 className="text-sm font-bold text-gray-900">Taller de Proyectos II</h4>
            <p className="text-xs text-gray-500">Aula 102 • P. Cotrina</p>
          </div>
        </div>
      </div>
    </div>
  );
}