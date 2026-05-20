"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  X, Move, Trash2, CheckCircle2, XCircle, Loader2, AlertTriangle, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BloqueAPI, AulaSimple, DIAS, DIAS_LABELS, TODAS_HORAS, TIPO_LABELS, courseStyle,
} from "@/lib/horario-utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ViolacionAPI = { restriccion: string; mensaje: string };
type ValidarResponse = { valido: boolean; violaciones: ViolacionAPI[] };

// ── Toast interno ─────────────────────────────────────────────────────────────

function Toast({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-sm border ${
      type === "success"
        ? "bg-green-50 border-green-200 text-green-700"
        : "bg-red-50 border-red-200 text-red-700"
    }`}>
      {type === "success"
        ? <CheckCircle2 className="h-4 w-4 shrink-0" />
        : <XCircle className="h-4 w-4 shrink-0" />}
      {msg}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function EditorBloque({
  bloque,
  onClose,
  onUpdated,
  onDeleted,
}: {
  bloque: BloqueAPI;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const { data: session } = useSession();

  const curso  = bloque.componente.seccion.curso;
  const style  = courseStyle(curso.id);

  // ── Estado del panel ────────────────────────────────────────────────────────
  type Mode = "info" | "mover" | "eliminar";
  const [mode, setMode] = useState<Mode>("info");

  // Formulario de movimiento
  const [movDia,   setMovDia]   = useState(bloque.dia);
  const [movHora,  setMovHora]  = useState(
    String(parseInt(bloque.hora_inicio.split(":")[0])).padStart(2, "0") + ":00"
  );
  const [movAulaId, setMovAulaId] = useState(String(bloque.aula.id));

  // Aulas para el dropdown
  const [aulas,       setAulas]       = useState<AulaSimple[]>([]);
  const [loadingAulas, setLoadingAulas] = useState(false);

  // Validación en vivo
  const [validating,  setValidating]  = useState(false);
  const [validResult, setValidResult] = useState<ValidarResponse | null>(null);

  // Estado de guardado / eliminación
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Carga aulas al montar ───────────────────────────────────────────────────
  useEffect(() => {
    if (!session?.user?.access_token) return;
    setLoadingAulas(true);
    fetch(`${API}/api/horario/aulas-all`, {
      headers: { Authorization: `Bearer ${session.user.access_token}` },
    })
      .then(r => r.json())
      .then((data: AulaSimple[]) => setAulas(data))
      .catch(() => {})
      .finally(() => setLoadingAulas(false));
  }, [session?.user?.access_token]);

  // ── Validación en vivo (debounced) ──────────────────────────────────────────
  const doValidate = useCallback(async () => {
    if (!session?.user?.access_token) return;
    setValidating(true);
    setValidResult(null);
    try {
      const res = await fetch(`${API}/api/horario/validar-movimiento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.access_token}`,
        },
        body: JSON.stringify({
          bloque_id: bloque.id,
          nuevo_dia: movDia,
          nueva_hora_inicio: movHora,
          nueva_aula_id: parseInt(movAulaId),
        }),
      });
      setValidResult(await res.json());
    } catch {
      setValidResult(null);
    } finally {
      setValidating(false);
    }
  }, [session?.user?.access_token, bloque.id, movDia, movHora, movAulaId]);

  useEffect(() => {
    if (mode !== "mover") return;
    const t = setTimeout(doValidate, 350);
    return () => clearTimeout(t);
  }, [mode, doValidate]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleConfirmMove = async () => {
    if (!session?.user?.access_token || !validResult?.valido) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/horario/bloques/${bloque.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.access_token}`,
        },
        body: JSON.stringify({ dia: movDia, hora_inicio: movHora, aula_id: parseInt(movAulaId) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message ?? err?.detail ?? "Error al mover");
      }
      setToast({ type: "success", msg: "Bloque movido correctamente" });
      setTimeout(() => { onUpdated(); onClose(); }, 1200);
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Error al mover el bloque" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!session?.user?.access_token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API}/api/horario/bloques/${bloque.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) throw new Error("Error al eliminar");
      setToast({ type: "success", msg: "Bloque eliminado. Componente quedó pendiente." });
      setTimeout(() => { onDeleted(); onClose(); }, 1200);
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Error al eliminar" });
    } finally {
      setDeleting(false);
    }
  };

  const resetToInfo = () => { setMode("info"); setValidResult(null); };

  // ── Renderizado ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop semitransparente */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel lateral derecho */}
      <div
        className="absolute right-0 top-0 h-full w-96 bg-white shadow-2xl flex flex-col overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header coloreado con info del bloque */}
        <div className="p-4 flex items-start justify-between shrink-0" style={{ backgroundColor: style.backgroundColor }}>
          <div className="flex-1 pr-2 min-w-0">
            <p className="text-xs font-medium opacity-70" style={{ color: style.color }}>
              {TIPO_LABELS[bloque.componente.tipo] ?? bloque.componente.tipo}
              {" · "}
              {bloque.hora_inicio}–{bloque.hora_fin}
            </p>
            <h3 className="font-bold text-base leading-tight mt-0.5 truncate" style={{ color: style.color }}>
              {curso.nombre}
            </h3>
            <p className="text-xs mt-1 opacity-70" style={{ color: style.color }}>
              {curso.codigo} · Ciclo {curso.ciclo}° · Sec.{bloque.componente.seccion.letra}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-black/10 transition-colors shrink-0"
          >
            <X className="h-5 w-5" style={{ color: style.color }} />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 p-4 space-y-4">
          {/* Toast */}
          {toast && <Toast type={toast.type} msg={toast.msg} />}

          {/* Info resumen */}
          <div className="space-y-2 text-sm">
            <Row label="Día y hora">
              {DIAS_LABELS[bloque.dia]}, {bloque.hora_inicio}–{bloque.hora_fin}
              {" "}({bloque.componente.horas_semanales}h/sem)
            </Row>
            <Row label="Docente">
              {bloque.componente.docente?.nombre ?? "Sin docente asignado"}
            </Row>
            <Row label="Aula">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {bloque.aula.codigo}
                <span className="text-gray-400">·</span>
                cap. {bloque.aula.capacidad}
              </span>
            </Row>
            <Row label="Alumnos">
              {bloque.componente.seccion.num_alumnos}
            </Row>
          </div>

          {/* ── Modo: botones de acción ─────────────────────────────────────── */}
          {mode === "info" && (
            <div className="space-y-2 pt-3 border-t">
              <Button
                size="sm"
                variant="outline"
                className="w-full flex items-center gap-2 justify-start"
                onClick={() => setMode("mover")}
              >
                <Move className="h-4 w-4 text-blue-500" />
                Mover a otro slot
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="w-full flex items-center gap-2 justify-start text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setMode("eliminar")}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar bloque
              </Button>
            </div>
          )}

          {/* ── Modo: mover ──────────────────────────────────────────────────── */}
          {mode === "mover" && (
            <div className="space-y-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                <button
                  onClick={resetToInfo}
                  className="text-xs text-muted-foreground hover:text-gray-700 transition-colors"
                >
                  ← Volver
                </button>
                <span className="text-sm font-semibold">Mover bloque</span>
              </div>

              {/* Selector de día */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Día</label>
                <div className="flex gap-1.5 flex-wrap">
                  {DIAS.map(d => (
                    <button
                      key={d}
                      onClick={() => setMovDia(d)}
                      className={[
                        "px-3 py-1 rounded text-xs font-medium border transition-colors",
                        movDia === d
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                      ].join(" ")}
                    >
                      {DIAS_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de hora */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Hora de inicio</label>
                <div className="grid grid-cols-6 gap-1">
                  {TODAS_HORAS.map(h => {
                    const hStr = String(h).padStart(2, "0") + ":00";
                    const isSep = h === 14;
                    return (
                      <button
                        key={h}
                        onClick={() => setMovHora(hStr)}
                        className={[
                          "py-1 rounded text-xs font-mono border transition-colors",
                          isSep ? "col-start-1" : "",
                          movHora === hStr
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {h}h
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground italic">7-12h mañana · 14-19h tarde</p>
              </div>

              {/* Selector de aula */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Aula</label>
                {loadingAulas ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Cargando aulas...
                  </div>
                ) : (
                  <select
                    value={movAulaId}
                    onChange={e => setMovAulaId(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {aulas.map(a => (
                      <option key={a.id} value={String(a.id)}>
                        {a.codigo} — {a.tipo} (cap. {a.capacidad})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Resultado de validación */}
              {validating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Validando restricciones…
                </div>
              )}

              {validResult && !validating && (
                <div className={`rounded-lg border p-3 ${
                  validResult.valido
                    ? "bg-green-50 border-green-200"
                    : "bg-red-50 border-red-200"
                }`}>
                  {validResult.valido ? (
                    <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Movimiento válido — sin conflictos
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                        <XCircle className="h-4 w-4 shrink-0" />
                        Movimiento inválido
                      </div>
                      <ul className="space-y-1.5">
                        {validResult.violaciones.map((v, i) => (
                          <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                            <span className="font-mono font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">
                              {v.restriccion}
                            </span>
                            <span>{v.mensaje}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de confirmación */}
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={resetToInfo}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!validResult?.valido || saving || validating || loadingAulas}
                  onClick={handleConfirmMove}
                >
                  {saving
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : "Confirmar movimiento"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Modo: eliminar ───────────────────────────────────────────────── */}
          {mode === "eliminar" && (
            <div className="space-y-4 pt-3 border-t">
              <div className="flex items-center gap-2">
                <button
                  onClick={resetToInfo}
                  className="text-xs text-muted-foreground hover:text-gray-700 transition-colors"
                >
                  ← Volver
                </button>
                <span className="text-sm font-semibold text-red-600">Eliminar bloque</span>
              </div>

              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <p className="font-medium">¿Eliminar este bloque?</p>
                    <p className="text-xs mt-1 opacity-80">
                      El componente quedará sin programar y aparecerá en el panel
                      de pendientes. Esta acción es reversible regenerando el horario.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <p className="font-medium">{curso.nombre}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {TIPO_LABELS[bloque.componente.tipo]} · Sec.{bloque.componente.seccion.letra}
                  {" · "}{DIAS_LABELS[bloque.dia]} {bloque.hora_inicio}–{bloque.hora_fin}
                  {" · "}{bloque.aula.codigo}
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={resetToInfo}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  {deleting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : "Sí, eliminar"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helper interno ────────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{children}</span>
    </div>
  );
}
