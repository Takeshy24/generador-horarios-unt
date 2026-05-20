"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BookOpen, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Componente = {
  id: number;
  curso_nombre: string;
  ciclo: number;
  seccion_letra: string;
  tipo: "T" | "P" | "L";
  horas_semanales: number;
  docente_id: number | null;
  docente_nombre: string | null;
  esta_asignado: boolean;
};

type Semestre = { id: number; codigo: string };

type SeccionGroup = {
  seccion_letra: string;
  componentes: Componente[];
};

type CursoGroup = {
  curso_nombre: string;
  secciones: Record<string, SeccionGroup>;
};

type CicloGroup = Record<string, CursoGroup>;

const TIPO_STYLES: Record<string, string> = {
  T: "bg-blue-100 text-blue-700 border-blue-200",
  P: "bg-green-100 text-green-700 border-green-200",
  L: "bg-purple-100 text-purple-700 border-purple-200",
};

const TIPO_LABEL: Record<string, string> = {
  T: "Teoría",
  P: "Práctica",
  L: "Laboratorio",
};

function ComponenteBadge({ comp }: { comp: Componente }) {
  return (
    <div className={`inline-flex flex-col items-start rounded border px-2 py-1 text-xs ${TIPO_STYLES[comp.tipo]}`}>
      <span className="font-semibold">
        {TIPO_LABEL[comp.tipo]} · {comp.horas_semanales}h
      </span>
      {comp.esta_asignado ? (
        <span className="text-gray-600 truncate max-w-[160px]">
          {comp.docente_nombre?.split(",")[0] ?? "—"}
        </span>
      ) : (
        <span className="text-red-500 font-medium">Sin docente</span>
      )}
    </div>
  );
}

export default function CursosDelSemestrePage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [semestre, setSemestre] = useState<Semestre | null>(null);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cicloActivo, setCicloActivo] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const semRes = await fetch(`${API}/api/semestres/activo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!semRes.ok) throw new Error("No hay semestre activo");
      const sem: Semestre = await semRes.json();
      setSemestre(sem);

      const compRes = await fetch(
        `${API}/api/asignaciones/componentes?semestre_id=${sem.id}&mostrar_todas=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!compRes.ok) throw new Error("Error al cargar componentes");
      const comps: Componente[] = await compRes.json();
      setComponentes(comps);

      const ciclos = [...new Set(comps.map((c) => c.ciclo))].sort((a, b) => a - b);
      if (ciclos.length > 0) setCicloActivo(ciclos[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-sm text-muted-foreground">Cargando...</div>;

  // Group: ciclo → curso_nombre → seccion_letra → componentes
  const byCiclo: Record<number, CicloGroup> = {};
  for (const comp of componentes) {
    if (!byCiclo[comp.ciclo]) byCiclo[comp.ciclo] = {};
    if (!byCiclo[comp.ciclo][comp.curso_nombre]) {
      byCiclo[comp.ciclo][comp.curso_nombre] = { curso_nombre: comp.curso_nombre, secciones: {} };
    }
    if (!byCiclo[comp.ciclo][comp.curso_nombre].secciones[comp.seccion_letra]) {
      byCiclo[comp.ciclo][comp.curso_nombre].secciones[comp.seccion_letra] = {
        seccion_letra: comp.seccion_letra,
        componentes: [],
      };
    }
    byCiclo[comp.ciclo][comp.curso_nombre].secciones[comp.seccion_letra].componentes.push(comp);
  }

  const ciclos = Object.keys(byCiclo).map(Number).sort((a, b) => a - b);
  const totalCursos = new Set(componentes.map((c) => c.curso_nombre)).size;
  const totalSecciones = new Set(componentes.map((c) => `${c.curso_nombre}-${c.ciclo}-${c.seccion_letra}`)).size;
  const totalAsignados = componentes.filter((c) => c.esta_asignado).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline-lg text-foreground">Cursos del Semestre</h1>
          <p className="text-sm text-muted-foreground">
            {semestre?.codigo ?? "—"} · {totalCursos} cursos · {totalSecciones} secciones
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {totalAsignados === componentes.length ? (
            <span className="flex items-center gap-1.5 text-green-700 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Todos los componentes asignados
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-yellow-700 font-medium">
              <AlertCircle className="h-4 w-4" />
              {componentes.length - totalAsignados} componentes sin docente
            </span>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Tabs de ciclo */}
      {ciclos.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ciclos.map((ciclo) => (
            <button
              key={ciclo}
              onClick={() => setCicloActivo(ciclo)}
              className={[
                "px-3 py-1 rounded-full text-sm font-medium transition-colors border",
                cicloActivo === ciclo
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600",
              ].join(" ")}
            >
              Ciclo {ciclo}
            </button>
          ))}
        </div>
      )}

      {/* Contenido del ciclo activo */}
      {cicloActivo !== null && byCiclo[cicloActivo] && (
        <div className="space-y-3">
          {Object.values(byCiclo[cicloActivo])
            .sort((a, b) => a.curso_nombre.localeCompare(b.curso_nombre))
            .map((curso) => {
              const secciones = Object.values(curso.secciones).sort((a, b) =>
                a.seccion_letra.localeCompare(b.seccion_letra)
              );
              const totalComps = secciones.reduce((n, s) => n + s.componentes.length, 0);
              const asignados = secciones.reduce(
                (n, s) => n + s.componentes.filter((c) => c.esta_asignado).length,
                0
              );

              return (
                <div key={curso.curso_nombre} className="rounded-lg border bg-white overflow-hidden">
                  {/* Cabecera del curso */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-sm text-gray-900">{curso.curso_nombre}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {secciones.length} sección{secciones.length !== 1 ? "es" : ""}
                      </span>
                      <Badge
                        variant="outline"
                        className={asignados === totalComps ? "text-green-700 border-green-300" : "text-yellow-700 border-yellow-300"}
                      >
                        {asignados}/{totalComps} asignados
                      </Badge>
                    </div>
                  </div>

                  {/* Secciones */}
                  <div className="divide-y">
                    {secciones.map((sec) => (
                      <div key={sec.seccion_letra} className="px-4 py-3 flex items-start gap-4">
                        <div className="w-16 shrink-0 pt-0.5">
                          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                            {sec.seccion_letra}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 flex-1">
                          {sec.componentes
                            .sort((a, b) => {
                              const order = { T: 0, P: 1, L: 2 };
                              return order[a.tipo] - order[b.tipo];
                            })
                            .map((comp) => (
                              <ComponenteBadge key={comp.id} comp={comp} />
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {componentes.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-muted-foreground text-sm">
          No hay cursos registrados para este semestre
        </div>
      )}

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span className="font-medium">Tipo de componente:</span>
        {Object.entries(TIPO_LABEL).map(([tipo, label]) => (
          <span key={tipo} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${TIPO_STYLES[tipo]}`}>
            <span className="font-semibold">{tipo}</span> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
