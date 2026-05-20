"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CheckCircle2, AlertCircle, User, BookOpen, ChevronRight, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TIPO_COLORS: Record<string, string> = {
  T: "bg-blue-100 text-blue-700",
  P: "bg-green-100 text-green-700",
  L: "bg-purple-100 text-purple-700",
};
const TIPO_LABELS: Record<string, string> = { T: "Teoría", P: "Práctica", L: "Lab" };

type Componente = {
  id: number;
  curso_nombre: string;
  ciclo: number;
  seccion_letra: string;
  tipo: string;
  horas_semanales: number;
  docente_id: number | null;
  docente_nombre: string | null;
  esta_asignado: boolean;
};

type Candidato = {
  docente_id: number;
  nombre: string;
  tipo: string;
  regimen: string;
  categoria: string | null;
  antiguedad_anos: number;
  tope_horas: number;
  horas_asignadas: number;
  horas_libres: number;
  horas_disponibles_total: number;
  disponibilidad_suficiente: boolean;
  es_actual: boolean;
};

type DetalleComponente = {
  componente: {
    id: number;
    curso_nombre: string;
    ciclo: number;
    seccion_letra: string;
    tipo: string;
    horas_semanales: number;
    docente_actual_id: number | null;
    docente_actual_nombre: string | null;
  };
  candidatos: Candidato[];
};

export default function AsignacionesPage() {
  const { data: session } = useSession();
  const [semestreId, setSemestreId] = useState<number | null>(null);
  const [componentes, setComponentes] = useState<Componente[]>([]);
  const [mostrarTodas, setMostrarTodas] = useState(true);
  const [filtroCiclo, setFiltroCiclo] = useState<number | "">("");
  const [seleccionado, setSeleccionado] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<DetalleComponente | null>(null);
  const [loadingComp, setLoadingComp] = useState(true);
  const [loadingDet, setLoadingDet] = useState(false);
  const [asignando, setAsignando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const token = session?.user.access_token;

  // Load semestre activo
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/api/semestres/activo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setSemestreId(d.id))
      .catch(() => setSemestreId(1)); // fallback
  }, [token]);

  const fetchComponentes = useCallback(async () => {
    if (!token || !semestreId) return;
    setLoadingComp(true);
    try {
      const res = await fetch(
        `${API}/api/asignaciones/componentes?semestre_id=${semestreId}&mostrar_todas=${mostrarTodas}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      setComponentes(data);
    } catch {}
    finally { setLoadingComp(false); }
  }, [token, semestreId, mostrarTodas]);

  useEffect(() => { fetchComponentes(); }, [fetchComponentes]);

  async function seleccionar(id: number) {
    if (!token) return;
    setSeleccionado(id);
    setDetalle(null);
    setMensaje(null);
    setLoadingDet(true);
    try {
      const res = await fetch(`${API}/api/asignaciones/candidatos/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDetalle(data);
    } catch {}
    finally { setLoadingDet(false); }
  }

  async function asignar(docenteId: number) {
    if (!token || !seleccionado) return;
    setAsignando(docenteId);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/asignaciones/asignar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ componente_id: seleccionado, docente_id: docenteId }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMensaje({ tipo: "error", texto: err.detail ?? "Error al asignar" });
        return;
      }
      setMensaje({ tipo: "ok", texto: "Docente asignado correctamente." });
      fetchComponentes();
      seleccionar(seleccionado);
    } catch {
      setMensaje({ tipo: "error", texto: "Error de red al asignar" });
    } finally {
      setAsignando(null);
    }
  }

  const ciclos = [...new Set(componentes.map(c => c.ciclo))].sort((a, b) => a - b);
  const compFiltrados = componentes.filter(c => filtroCiclo === "" || c.ciclo === filtroCiclo);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-headline-lg text-foreground">Asignar Cursos a Docentes</h1>
        <p className="text-muted-foreground text-sm">
          Semestre 2026-I · Prelación: nombrados por antigüedad → contratados por antigüedad
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === "ok" ? "success" : "destructive"}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[600px]">
        {/* COLUMNA IZQUIERDA: Lista de componentes */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            <select
              value={filtroCiclo}
              onChange={e => setFiltroCiclo(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="h-8 rounded border border-gray-200 bg-white px-2 text-sm text-gray-700 focus:outline-none"
            >
              <option value="">Todos los ciclos</option>
              {ciclos.map(c => <option key={c} value={c}>{c}° ciclo</option>)}
            </select>
            <button
              onClick={() => setMostrarTodas(v => !v)}
              className={[
                "h-8 px-3 rounded border text-xs font-medium transition-colors",
                mostrarTodas
                  ? "bg-gray-100 border-gray-300 text-gray-700"
                  : "bg-blue-600 border-blue-600 text-white",
              ].join(" ")}
            >
              {mostrarTodas ? "Mostrando todas" : "Solo sin asignar"}
            </button>
          </div>

          {/* Lista */}
          <div className="border rounded-lg overflow-hidden bg-white">
            {loadingComp ? (
              <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">
                Cargando componentes...
              </div>
            ) : compFiltrados.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                No hay componentes{!mostrarTodas ? " sin asignar" : ""} con los filtros actuales.
              </div>
            ) : (
              <div className="divide-y max-h-[580px] overflow-y-auto">
                {compFiltrados.map(c => (
                  <button
                    key={c.id}
                    onClick={() => seleccionar(c.id)}
                    className={[
                      "w-full text-left px-3 py-2.5 flex items-center gap-2 transition-colors hover:bg-gray-50",
                      seleccionado === c.id ? "bg-blue-50 border-l-2 border-l-blue-500" : "",
                    ].join(" ")}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TIPO_COLORS[c.tipo]}`}>
                          {TIPO_LABELS[c.tipo]}
                        </span>
                        <Badge variant="outline" className="text-xs">{c.ciclo}°</Badge>
                        <span className="text-xs font-mono text-gray-500">Sec.{c.seccion_letra}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{c.curso_nombre}</p>
                      <p className="text-xs text-muted-foreground">{c.horas_semanales}h/sem</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1">
                      {c.esta_asignado ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      <ChevronRight className="h-3 w-3 text-gray-400" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {compFiltrados.length} componentes · {compFiltrados.filter(c => c.esta_asignado).length} asignados
          </p>
        </div>

        {/* COLUMNA DERECHA: Detalle y candidatos */}
        <div className="lg:col-span-3">
          {!seleccionado ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center text-muted-foreground py-16">
                <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Selecciona un componente de la lista para ver los candidatos.</p>
              </CardContent>
            </Card>
          ) : loadingDet ? (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-muted-foreground animate-pulse py-16">
                Cargando candidatos...
              </CardContent>
            </Card>
          ) : detalle ? (
            <div className="space-y-3">
              {/* Info componente */}
              <Card className="bg-gray-50">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-sm px-2 py-1 rounded font-medium ${TIPO_COLORS[detalle.componente.tipo]}`}>
                      {TIPO_LABELS[detalle.componente.tipo]}
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{detalle.componente.curso_nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {detalle.componente.ciclo}° ciclo · Sección {detalle.componente.seccion_letra} · {detalle.componente.horas_semanales}h/sem
                      </p>
                    </div>
                    {detalle.componente.docente_actual_nombre && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-muted-foreground">Docente actual</p>
                        <p className="text-sm font-medium text-green-700">{detalle.componente.docente_actual_nombre}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Candidatos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-600" />
                    Candidatos por prelación ({detalle.candidatos.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[440px] overflow-y-auto">
                    {detalle.candidatos.map((cand, idx) => (
                      <div
                        key={cand.docente_id}
                        className={[
                          "px-4 py-3 flex items-center gap-3",
                          cand.es_actual ? "bg-green-50" : "",
                        ].join(" ")}
                      >
                        {/* Número de prelación */}
                        <div className={[
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          idx === 0 ? "bg-yellow-100 text-yellow-700" :
                          idx === 1 ? "bg-gray-100 text-gray-600" :
                          "bg-gray-50 text-gray-400",
                        ].join(" ")}>
                          {idx + 1}
                        </div>

                        {/* Datos docente */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{cand.nombre}</p>
                            {cand.es_actual && (
                              <Badge className="text-xs bg-green-600">Actual</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-xs capitalize">{cand.tipo}</Badge>
                            <span className="text-xs text-muted-foreground">{cand.regimen}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">{cand.antiguedad_anos} años</span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className={cand.horas_libres >= detalle.componente.horas_semanales ? "text-green-600" : "text-red-500"}>
                              Cupo: {cand.horas_asignadas}/{cand.tope_horas}h
                              ({cand.horas_libres >= 0 ? `${cand.horas_libres}h libre` : "excedido"})
                            </span>
                            <span className="text-gray-400">·</span>
                            {cand.disponibilidad_suficiente ? (
                              <span className="text-green-600 flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3" /> Disponibilidad OK
                              </span>
                            ) : (
                              <span className="text-yellow-600 flex items-center gap-0.5">
                                <AlertCircle className="h-3 w-3" /> Disponibilidad insuficiente
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Botón asignar */}
                        <Button
                          size="sm"
                          variant={cand.es_actual ? "outline" : "default"}
                          disabled={
                            !cand.disponibilidad_suficiente ||
                            asignando === cand.docente_id ||
                            cand.es_actual
                          }
                          onClick={() => asignar(cand.docente_id)}
                          className="shrink-0 text-xs h-7"
                        >
                          {asignando === cand.docente_id
                            ? "..."
                            : cand.es_actual
                            ? "Asignado"
                            : "Asignar"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
