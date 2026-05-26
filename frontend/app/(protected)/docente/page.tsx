import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, BookOpen, Calendar, CheckCircle2, AlertCircle, ArrowRight, BookMarked } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getDocenteMe(token: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/docentes/me`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const REGIMEN_LABELS: Record<string, string> = {
  DE: "Dedicación Exclusiva",
  TC: "Tiempo Completo",
  TP1: "Tiempo Parcial 1",
  TP2: "Tiempo Parcial 2",
  TP3: "Tiempo Parcial 3",
  CONTRATO_A1: "Contrato A1",
  CONTRATO_A2: "Contrato A2",
  CONTRATO_A3: "Contrato A3",
  CONTRATO_B1: "Contrato B1",
  CONTRATO_B2: "Contrato B2",
  CONTRATO_B3: "Contrato B3",
};

export default async function DocenteDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  const docente = await getDocenteMe(session.user.access_token);
  const nombre = docente?.nombre_completo ?? session.user.name ?? "Docente";

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-foreground">
            Bienvenido, {nombre.split(",")[0]}
          </h1>
          <p className="text-body-md text-muted-foreground mt-1">Semestre académico 2026-I</p>
        </div>
        {docente && (
          <div className="flex gap-2">
            <Badge variant="secondary">{docente.tipo === "nombrado" ? "Nombrado" : "Contratado"}</Badge>
            <Badge variant="outline">{REGIMEN_LABELS[docente.regimen] ?? docente.regimen}</Badge>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/docente/disponibilidad" className="group">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-blue-50 p-3">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <CardTitle className="text-base mt-3">Mi Disponibilidad</CardTitle>
              <CardDescription className="text-xs">
                Grilla semanal L-V declarada para este semestre
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Disponibilidad pre-cargada. Puedes modificarla antes de la generación del horario.
              </p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 font-medium">
                Ver disponibilidad <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/docente/cursos" className="group">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-green-50 p-3">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <CardTitle className="text-base mt-3">Mis Cursos Asignados</CardTitle>
              <CardDescription className="text-xs">
                Componentes T/P/L asignados por el Director de Departamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Ver detalle de horas semanales y secciones a cargo.
              </p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 font-medium">
                Ver cursos <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/docente/horario" className="group">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-warning/30 bg-warning/5 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-amber-50 p-3">
                  <Calendar className="h-6 w-6 text-amber-600" />
                </div>
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
              <CardTitle className="text-base mt-3">Mi Horario</CardTitle>
              <CardDescription className="text-xs">
                Horario del semestre 2026-I
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                Disponible una vez que el Director de Escuela publique el horario.
              </p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 font-medium">
                Ver horario <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/docente/recuperacion" className="group">
          <Card className="hover:shadow-lg transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30 h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="rounded-xl bg-indigo-50 p-3">
                  <BookMarked className="h-6 w-6 text-indigo-600" />
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <CardTitle className="text-base mt-3">Clases de Recuperación</CardTitle>
              <CardDescription className="text-xs">
                Reserva aulas y laboratorios disponibles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Consulta disponibilidad y agenda una clase de recuperación en el espacio que necesites.
              </p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 font-medium">
                Ver disponibilidad <ArrowRight className="h-3 w-3 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="bg-muted/50 border-border/50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <span className="text-foreground">
              <strong>Semestre 2026-I</strong> — 13 de abril al 8 de agosto de 2026
            </span>
            <Badge variant="outline" className="ml-auto text-xs">Asignando</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
