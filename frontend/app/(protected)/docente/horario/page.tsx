"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Calendar, Download, Loader2, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  buildGrid, DIAS, DIAS_LABELS, TODAS_HORAS,
  TIPO_BADGES, courseStyle, type BloqueAPI,
} from "@/lib/horario-utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type DocenteInfo = { id: number; nombre_completo: string; tipo: string; regimen: string };
type SemestreInfo = { id: number; codigo: string; estado: string };

export default function MiHorarioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [docente,      setDocente]      = useState<DocenteInfo | null>(null);
  const [semestre,     setSemestre]     = useState<SemestreInfo | null>(null);
  const [bloques,      setBloques]      = useState<BloqueAPI[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [downloading,    setDownloading]    = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);

  const loadData = useCallback(async () => {
    if (!session?.user?.access_token) return;
    const token = session.user.access_token;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [docRes, semRes] = await Promise.all([
        fetch(`${API}/api/docentes/me`, { headers }),
        fetch(`${API}/api/semestres/activo`, { headers }),
      ]);
      const doc: DocenteInfo = await docRes.json();
      const sem: SemestreInfo = await semRes.json();
      setDocente(doc);
      setSemestre(sem);

      if (sem.estado === "publicado") {
        const horarioRes = await fetch(
          `${API}/api/horario/semestre/${sem.id}/docente/${doc.id}`,
          { headers }
        );
        const horario = await horarioRes.json();
        setBloques(horario.bloques ?? []);
      }
    } catch {
      setError("Error al cargar el horario. Intenta recargar la página.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (session.user.role !== "docente") { router.replace("/"); return; }
    loadData();
  }, [status, session, router, loadData]);

  const handleDescargarExcel = async () => {
    if (!session?.user?.access_token || !semestre || !docente) return;
    setDownloadingXlsx(true);
    try {
      const res = await fetch(
        `${API}/api/horario/excel/docente/${docente.id}?semestre_id=${semestre.id}`,
        { headers: { Authorization: `Bearer ${session.user.access_token}` } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `mi_horario_${semestre.codigo}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      setError("Error al descargar el Excel.");
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handleDescargarPdf = async () => {
    if (!session?.user?.access_token || !semestre || !docente) return;
    setDownloading(true);
    try {
      const res = await fetch(
        `${API}/api/horario/pdf/docente/${docente.id}?semestre_id=${semestre.id}`,
        { headers: { Authorization: `Bearer ${session.user.access_token}` } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `mi_horario_${semestre.codigo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch {
      setError("Error al descargar el PDF.");
    } finally {
      setDownloading(false);
    }
  };

  // ── Estados de carga ─────────────────────────────────────────────────────────
  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Cargando horario...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mi Horario</h1>
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      </div>
    );
  }

  // Horario no publicado
  if (!semestre || semestre.estado !== "publicado") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mi Horario</h1>
        <Card className="border-yellow-200">
          <CardContent className="py-14 flex flex-col items-center gap-4 text-center">
            <Lock className="h-14 w-14 text-yellow-400" />
            <div>
              <h2 className="text-lg font-semibold text-gray-700">Horario no disponible</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                El Director de Escuela aún no ha publicado el horario
                {semestre ? ` del semestre ${semestre.codigo}` : ""}.
                Vuelve a verificar cuando sea publicado.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sin bloques asignados
  if (bloques.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Mi Horario</h1>
        <Card>
          <CardContent className="py-14 flex flex-col items-center gap-4 text-center">
            <Calendar className="h-14 w-14 text-gray-300" />
            <p className="text-sm text-muted-foreground">
              No tienes clases asignadas en el semestre {semestre.codigo}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const grid = buildGrid(bloques);

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline-lg text-foreground">Mi Horario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {docente?.nombre_completo} · Semestre {semestre.codigo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            Publicado
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDescargarPdf}
            disabled={downloading}
            className="flex items-center gap-1.5"
          >
            {downloading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            Descargar PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDescargarExcel}
            disabled={downloadingXlsx}
            className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
          >
            {downloadingXlsx
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Download className="h-4 w-4" />}
            Descargar Excel
          </Button>
        </div>
      </div>

      {/* Grilla del horario */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            Horario semanal — Semestre {semestre.codigo}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-blue-50">
                <th className="border border-gray-200 px-2 py-2.5 text-xs font-semibold text-gray-500 w-14 text-center">
                  Hora
                </th>
                {DIAS.map(d => (
                  <th
                    key={d}
                    className="border border-gray-200 px-2 py-2.5 text-xs font-semibold text-blue-800 min-w-[140px] text-center"
                  >
                    {DIAS_LABELS[d]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TODAS_HORAS.map(hora => (
                <tr key={hora}>
                  <td className="border border-gray-200 px-1 py-0 text-[11px] text-gray-400 text-center bg-gray-50 font-mono whitespace-nowrap h-10">
                    {hora}:00
                  </td>
                  {DIAS.map(dia => {
                    const cell = grid[dia]?.[hora];
                    if (!cell || cell.kind === "spanned") return null;
                    if (cell.kind === "empty") {
                      return <td key={dia} className="border border-gray-200 h-10" />;
                    }
                    const b = cell.bloques[0];
                    const style = courseStyle(b.componente.seccion.curso.id);
                    return (
                      <td
                        key={dia}
                        rowSpan={cell.span}
                        className="border border-gray-200 p-1.5 align-top"
                        style={style}
                      >
                        <div className="flex flex-col gap-0.5 h-full">
                          <div className="flex items-start gap-1.5">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${TIPO_BADGES[b.componente.tipo] ?? "bg-gray-200"}`}
                            >
                              {b.componente.tipo}
                            </span>
                            <span className="text-xs font-semibold leading-tight line-clamp-2">
                              {b.componente.seccion.curso.nombre}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-600 pl-0.5">
                            {b.aula.codigo} · Sec.{b.componente.seccion.letra}
                          </p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {[
          { tipo: "T", label: "Teoría",    cls: TIPO_BADGES["T"] },
          { tipo: "P", label: "Práctica",  cls: TIPO_BADGES["P"] },
          { tipo: "L", label: "Laboratorio", cls: TIPO_BADGES["L"] },
        ].map(({ tipo, label, cls }) => (
          <div key={tipo} className="flex items-center gap-1.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${cls}`}>{tipo}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
