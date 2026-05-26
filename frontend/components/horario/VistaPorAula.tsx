"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BloqueAPI, AulaSimple, DIAS, DIAS_LABELS, HORAS_MANANA, TODAS_HORAS,
  TIPO_LABELS, TIPO_BADGES, CICLO_ROMANO, courseStyle, apellido,
  buildGrid, CellState,
} from "@/lib/horario-utils";
import { EditorBloque } from "@/components/horario/EditorBloque";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TIPO_AULA_LABELS: Record<string, string> = {
  comun:        "Aula común",
  lab_computo:  "Lab. Cómputo",
  lab_redes:    "Lab. Redes",
  lab_bd:       "Lab. Base de Datos",
  lab_ia:       "Lab. IA",
  lab_software: "Lab. Software",
  auditorio:    "Auditorio",
};

// ── Celda de bloque ───────────────────────────────────────────────────────────

function BlockCell({ bloque, onClick }: { bloque: BloqueAPI; onClick: () => void }) {
  const curso  = bloque.componente.seccion.curso;
  const tipo   = bloque.componente.tipo;
  const style  = courseStyle(curso.id);

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
      {bloque.componente.docente && (
        <p className="text-xs opacity-60 truncate leading-tight" style={{ color: style.color }}>
          {apellido(bloque.componente.docente.nombre)}
        </p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function VistaPorAula({ semestreId }: { semestreId: number }) {
  const { data: session } = useSession();

  const [aulas,       setAulas]       = useState<AulaSimple[]>([]);
  const [aulaId,      setAulaId]      = useState<number | null>(null);
  const [bloques,     setBloques]     = useState<BloqueAPI[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [loadingAulas, setLoadingAulas] = useState(true);
  const [bloqueEditor, setBloqueEditor] = useState<BloqueAPI | null>(null);

  // ── Carga lista de aulas ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.access_token) return;
    fetch(`${API}/api/horario/aulas-all`, {
      headers: { Authorization: `Bearer ${session.user.access_token}` },
    })
      .then(r => r.json())
      .then((data: AulaSimple[]) => {
        // Primero aulas comunes, luego labs
        const sorted = [...data].sort((a, b) => {
          if (a.tipo === "comun" && b.tipo !== "comun") return -1;
          if (a.tipo !== "comun" && b.tipo === "comun") return 1;
          return a.codigo.localeCompare(b.codigo);
        });
        setAulas(sorted);
        if (sorted.length > 0) setAulaId(sorted[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingAulas(false));
  }, [session?.user?.access_token]);

  // ── Carga bloques del aula ─────────────────────────────────────────────────
  const fetchBloques = useCallback(async () => {
    if (!session?.user?.access_token || !aulaId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/horario/semestre/${semestreId}/aula/${aulaId}`,
        { headers: { Authorization: `Bearer ${session.user.access_token}` } }
      );
      const data = await res.json();
      setBloques(data.bloques ?? []);
    } catch {
      setBloques([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.access_token, semestreId, aulaId]);

  useEffect(() => { fetchBloques(); }, [fetchBloques]);

  const aulaActual = aulas.find(a => a.id === aulaId);
  const grid       = buildGrid(bloques);

  // Calcular ocupación del aula (horas/semana)
  const horasOcupadas = bloques.reduce((sum, b) => {
    const s = parseInt(b.hora_inicio.split(":")[0]);
    const e = parseInt(b.hora_fin.split(":")[0]);
    return sum + (e - s + 1);
  }, 0);

  if (loadingAulas) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm animate-pulse">
        Cargando aulas…
      </div>
    );
  }

  if (aulas.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm border rounded-lg">
        No hay aulas registradas.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de aula */}
      <div className="flex items-center gap-3 flex-wrap">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-gray-700 shrink-0">Aula:</span>
        <select
          value={aulaId ?? ""}
          onChange={e => setAulaId(Number(e.target.value))}
          className="flex-1 min-w-48 text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {/* Aulas comunes primero, luego labs */}
          {["comun", "lab_computo", "lab_redes", "lab_bd", "lab_ia", "lab_software", "auditorio"].map(tipo => {
            const grupo = aulas.filter(a => a.tipo === tipo);
            if (grupo.length === 0) return null;
            return (
              <optgroup key={tipo} label={TIPO_AULA_LABELS[tipo] ?? tipo}>
                {grupo.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} — cap. {a.capacidad}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
        {aulaActual && (
          <Badge variant="outline" className="text-xs shrink-0">
            {TIPO_AULA_LABELS[aulaActual.tipo] ?? aulaActual.tipo} · cap. {aulaActual.capacidad}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto shrink-0">
          {horasOcupadas}h ocupadas / semana
        </span>
      </div>

      {/* Grilla semanal */}
      {loading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground animate-pulse text-sm">
          Cargando horario…
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
                        title={`${DIAS_LABELS[dia]} ${hora}:00 — Libre`}
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
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded bg-gray-100 border border-gray-200" />
          Slot libre
        </span>
        {Object.entries(TIPO_LABELS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block w-4 h-4 rounded text-white text-center text-xs font-bold leading-4 ${TIPO_BADGES[k]}`}>{k}</span>
            {v}
          </span>
        ))}
        <span className="ml-auto italic">Haz clic en un bloque para editarlo</span>
      </div>

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
