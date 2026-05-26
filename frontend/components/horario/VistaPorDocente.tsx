"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BloqueAPI, DocenteSimple, DIAS, DIAS_LABELS, HORAS_MANANA, TODAS_HORAS,
  TIPO_LABELS, TIPO_BADGES, CICLO_ROMANO, courseStyle, apellido,
  buildGrid, CellState,
} from "@/lib/horario-utils";
import { EditorBloque } from "@/components/horario/EditorBloque";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Celda de bloque ───────────────────────────────────────────────────────────

function BlockCell({ bloque, onClick }: { bloque: BloqueAPI; onClick: () => void }) {
  const curso   = bloque.componente.seccion.curso;
  const tipo    = bloque.componente.tipo;
  const style   = courseStyle(curso.id);

  const nombre = curso.nombre.length > 24
    ? curso.nombre.substring(0, 22) + "…"
    : curso.nombre;

  return (
    <div
      onClick={onClick}
      className="h-full rounded border cursor-pointer hover:brightness-95 transition-all select-none px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden"
      style={{ ...style, borderWidth: "1px", minHeight: "52px" }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold leading-tight flex-1 truncate" style={{ color: style.color }}>
          {nombre}
        </p>
        <span className={`shrink-0 text-xs px-1 py-0 rounded text-white font-bold ${TIPO_BADGES[tipo]}`}>
          {tipo}
        </span>
      </div>
      <p className="text-xs opacity-70 font-mono leading-tight" style={{ color: style.color }}>
        Ciclo {CICLO_ROMANO[curso.ciclo]} · Sec.{bloque.componente.seccion.letra}
      </p>
      <p className="text-xs opacity-60 truncate leading-tight" style={{ color: style.color }}>
        {bloque.aula.codigo}
      </p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VistaPorDocente({ semestreId }: { semestreId: number }) {
  const { data: session } = useSession();

  const [docentes,       setDocentes]       = useState<DocenteSimple[]>([]);
  const [docenteId,      setDocenteId]      = useState<number | null>(null);
  const [bloques,        setBloques]        = useState<BloqueAPI[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [loadingDocentes, setLoadingDocentes] = useState(true);
  const [bloqueEditor,   setBloqueEditor]   = useState<BloqueAPI | null>(null);

  // ── Carga lista de docentes ────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.access_token) return;
    fetch(`${API}/api/horario/docentes-all`, {
      headers: { Authorization: `Bearer ${session.user.access_token}` },
    })
      .then(r => r.json())
      .then((data: DocenteSimple[]) => {
        setDocentes(data);
        if (data.length > 0) setDocenteId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingDocentes(false));
  }, [session?.user?.access_token]);

  // ── Carga bloques del docente ──────────────────────────────────────────────
  const fetchBloques = useCallback(async () => {
    if (!session?.user?.access_token || !docenteId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/horario/semestre/${semestreId}/docente/${docenteId}`,
        { headers: { Authorization: `Bearer ${session.user.access_token}` } }
      );
      const data = await res.json();
      setBloques(data.bloques ?? []);
    } catch {
      setBloques([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.access_token, semestreId, docenteId]);

  useEffect(() => { fetchBloques(); }, [fetchBloques]);

  const docenteActual = docentes.find(d => d.id === docenteId);
  const grid = buildGrid(bloques);

  // ── Carga inicial ──────────────────────────────────────────────────────────
  if (loadingDocentes) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
        Cargando docentes…
      </div>
    );
  }

  if (docentes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        No hay docentes registrados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de docente */}
      <div className="flex items-center gap-3 flex-wrap">
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-gray-700 shrink-0">Docente:</span>
        <select
          value={docenteId ?? ""}
          onChange={e => setDocenteId(Number(e.target.value))}
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {docentes.map(d => (
            <option key={d.id} value={d.id}>
              {d.nombre}
              {d.tipo === "nombrado" ? " (Nombrado)" : " (Contratado)"}
            </option>
          ))}
        </select>
        {docenteActual && (
          <Badge variant={docenteActual.tipo === "nombrado" ? "default" : "outline"} className="text-xs shrink-0">
            {docenteActual.tipo}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {bloques.length} bloques
        </span>
      </div>

      {/* Grilla semanal */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse text-sm">
          Cargando horario…
        </div>
      ) : bloques.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border rounded-lg gap-2">
          <Users className="h-8 w-8 opacity-30" />
          <p className="text-sm">Este docente no tiene bloques asignados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm" style={{ minWidth: "640px" }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="w-16 border-r border-b border-gray-200 px-2 py-2 text-xs text-muted-foreground font-medium text-right">
                  Hora
                </th>
                {DIAS.map(dia => (
                  <th
                    key={dia}
                    className="border-b border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 text-center"
                  >
                    {DIAS_LABELS[dia]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TODAS_HORAS.map((hora, idx) => {
                const rows: React.ReactNode[] = [];

                if (idx === HORAS_MANANA.length) {
                  rows.push(
                    <tr key="almuerzo" className="bg-orange-50">
                      <td className="border-r border-gray-200 px-2 py-1 text-right">
                        <span className="text-xs text-orange-600 font-medium">13:00</span>
                      </td>
                      <td colSpan={6} className="border-b border-gray-200 px-3 py-1">
                        <span className="text-xs text-orange-500 italic">— Almuerzo —</span>
                      </td>
                    </tr>
                  );
                }

                const cells = DIAS.map(dia => {
                  const cell: CellState = grid[dia][hora];
                  if (cell.kind === "spanned") return null;
                  if (cell.kind === "empty") {
                    return (
                      <td
                        key={dia}
                        className="border-r border-b border-gray-100 p-0.5 align-top"
                        style={{ minWidth: "110px", height: "52px", backgroundColor: "#f9fafb" }}
                      />
                    );
                  }
                  return (
                    <td
                      key={dia}
                      rowSpan={cell.span}
                      className="border-r border-b border-gray-100 p-0.5 align-top"
                      style={{ minWidth: "110px" }}
                    >
                      <div className="flex gap-1 h-full">
                        {cell.bloques.map((bloque, idx) => (
                          <div
                            key={bloque.id}
                            className="flex-1"
                            style={{
                              borderLeft: idx > 0 ? "1px solid #e5e7eb" : "none",
                              paddingLeft: idx > 0 ? "0.5rem" : "0",
                            }}
                          >
                            <BlockCell
                              bloque={bloque}
                              onClick={() => setBloqueEditor(bloque)}
                            />
                          </div>
                        ))}
                      </div>
                    </td>
                  );
                });

                rows.push(
                  <tr key={hora}>
                    <td className="border-r border-b border-gray-200 px-2 py-0.5 text-right align-top pt-1.5">
                      <span className="text-xs text-muted-foreground font-mono">
                        {String(hora).padStart(2, "0")}:00
                      </span>
                    </td>
                    {cells}
                  </tr>
                );

                return rows;
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Leyenda */}
      {bloques.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium">Tipos:</span>
          {Object.entries(TIPO_LABELS).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`inline-block w-4 h-4 rounded text-white text-center text-xs font-bold leading-4 ${TIPO_BADGES[k]}`}>{k}</span>
              {v}
            </span>
          ))}
          <span className="ml-auto italic">Haz clic en un bloque para editarlo</span>
        </div>
      )}

      {/* Editor de bloque */}
      {bloqueEditor && (
        <EditorBloque
          bloque={bloqueEditor}
          onClose={() => setBloqueEditor(null)}
          onUpdated={() => { setBloqueEditor(null); fetchBloques(); }}
          onDeleted={() => { setBloqueEditor(null); fetchBloques(); }}
        />
      )}
    </div>
  );
}
