"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BloqueAPI, DIAS, DIAS_LABELS, HORAS_MANANA, TODAS_HORAS,
  TIPO_LABELS, TIPO_BADGES, CICLO_ROMANO, courseStyle, apellido,
  buildGrid, CellState,
} from "@/lib/horario-utils";
import { EditorBloque } from "@/components/horario/EditorBloque";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const CICLOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// ── Helper: estado de almuerzo ────────────────────────────────────────────────

function checkAlmuerzo(bloques: BloqueAPI[], dia: string): "none" | "ok" | "warning" {
  const diaBlocks = bloques.filter(b => b.dia === dia);
  const hasManana = diaBlocks.some(b => parseInt(b.hora_inicio) < 13);
  const hasTarde  = diaBlocks.some(b => parseInt(b.hora_inicio) >= 14);
  if (!hasManana || !hasTarde) return "none";

  const violation = diaBlocks.some(b => {
    const s = parseInt(b.hora_inicio);
    const e = parseInt(b.hora_fin);
    return s <= 13 && e >= 13;
  });
  return violation ? "warning" : "ok";
}

// ── Celda de bloque ───────────────────────────────────────────────────────────

function BlockCell({ bloque, onClick }: { bloque: BloqueAPI; onClick: () => void }) {
  const curso  = bloque.componente.seccion.curso;
  const docente = bloque.componente.docente;
  const tipo   = bloque.componente.tipo;
  const style  = courseStyle(curso.id);

  const nombre = curso.nombre.length > 26
    ? curso.nombre.substring(0, 24) + "…"
    : curso.nombre;

  return (
    <div
      onClick={onClick}
      className="h-full rounded border cursor-pointer hover:brightness-95 transition-all select-none px-1.5 py-1 flex flex-col gap-0.5 overflow-hidden"
      style={{ ...style, borderWidth: "1px", minHeight: "52px" }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold leading-tight flex-1" style={{ color: style.color }}>
          {nombre}
        </p>
        <span className={`shrink-0 text-xs px-1 py-0 rounded text-white font-bold ${TIPO_BADGES[tipo]}`}>
          {tipo}
        </span>
      </div>
      {docente && (
        <p className="text-xs opacity-80 truncate leading-tight" style={{ color: style.color }}>
          {apellido(docente.nombre)}
        </p>
      )}
      <p className="text-xs opacity-60 truncate font-mono leading-tight" style={{ color: style.color }}>
        {bloque.aula.codigo}
      </p>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VistaPorCiclo({
  semestreId,
  ciclo,
  onCicloChange,
}: {
  semestreId: number;
  ciclo: number;
  onCicloChange: (c: number) => void;
}) {
  const { data: session } = useSession();
  const [bloques,       setBloques]       = useState<BloqueAPI[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [bloqueEditor,  setBloqueEditor]  = useState<BloqueAPI | null>(null);

  const fetchBloques = useCallback(async () => {
    if (!session?.user.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/horario/semestre/${semestreId}?ciclo=${ciclo}`,
        { headers: { Authorization: `Bearer ${session.user.access_token}` } }
      );
      const data = await res.json();
      setBloques(data.bloques ?? []);
    } catch {
      setBloques([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user.access_token, semestreId, ciclo]);

  useEffect(() => { fetchBloques(); }, [fetchBloques]);

  const grid = buildGrid(bloques);
  const almuerzoStatus = DIAS.reduce((acc, d) => {
    acc[d] = checkAlmuerzo(bloques, d);
    return acc;
  }, {} as Record<string, "none" | "ok" | "warning">);

  return (
    <div className="space-y-4">
      {/* Selector de ciclo */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Ciclo:</span>
        <div className="flex gap-1 flex-wrap">
          {CICLOS.map(c => (
            <button
              key={c}
              onClick={() => onCicloChange(c)}
              className={[
                "px-3 py-1 rounded text-sm font-semibold border transition-colors",
                ciclo === c
                  ? "bg-blue-600 border-blue-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              {CICLO_ROMANO[c]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {bloques.length} bloques · {ciclo}° ciclo
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse">
          Cargando horario del ciclo {CICLO_ROMANO[ciclo]}…
        </div>
      ) : bloques.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground border rounded-lg">
          No hay bloques programados para el ciclo {CICLO_ROMANO[ciclo]}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full border-collapse text-sm" style={{ minWidth: "640px" }}>
            <thead>
              <tr className="bg-gray-50">
                <th className="w-16 border-r border-b border-gray-200 px-2 py-2 text-xs text-muted-foreground font-medium text-right">
                  Hora
                </th>
                {DIAS.map(dia => {
                  const almuerzo = almuerzoStatus[dia];
                  return (
                    <th
                      key={dia}
                      className="border-b border-r border-gray-200 px-2 py-2 text-xs font-semibold text-gray-700 text-center"
                    >
                      <div className="flex items-center justify-center gap-1">
                        {DIAS_LABELS[dia]}
                        {almuerzo === "warning" && (
                          <span className="text-red-500 font-bold" title="Sin hora de almuerzo libre">⚠</span>
                        )}
                        {almuerzo === "ok" && (
                          <span className="text-green-500 text-xs" title="Hora de almuerzo respetada">✓</span>
                        )}
                      </div>
                    </th>
                  );
                })}
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
                      <td colSpan={5} className="border-b border-gray-200 px-3 py-1">
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
                        style={{ minWidth: "110px", height: "52px" }}
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
                      <BlockCell
                        bloque={cell.bloque}
                        onClick={() => setBloqueEditor(cell.bloque)}
                      />
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
          <span className="font-medium">Componentes:</span>
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
