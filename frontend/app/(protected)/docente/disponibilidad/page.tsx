"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Save, Edit3, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB"] as const;
const DIAS_LABELS: Record<string, string> = {
  LUN: "Lunes", MAR: "Martes", MIE: "Miércoles", JUE: "Jueves", VIE: "Viernes", SAB: "Sábado",
};
// Jornada real continua: 7-13 (manana) y 14-20 (tarde).
const HORAS_MANANA = [7, 8, 9, 10, 11, 12, 13];
const HORAS_TARDE = [14, 15, 16, 17, 18, 19, 20];
const TODAS_HORAS = [...HORAS_MANANA, ...HORAS_TARDE];

const HORAS_REQUERIDAS_LABEL: Record<string, number> = {
  DE: 40, TC: 40, TP1: 20, TP2: 16, TP3: 12,
  CONTRATO_A1: 16, CONTRATO_A2: 20, CONTRATO_A3: 24,
  CONTRATO_B1: 16, CONTRATO_B2: 20, CONTRATO_B3: 24,
};

type Grilla = Record<string, Set<number>>;

function expandRanges(disponibilidades: { dia: string; hora_inicio: string; hora_fin: string }[]): Grilla {
  const g: Grilla = {};
  DIAS.forEach(d => g[d] = new Set());
  for (const r of disponibilidades) {
    const hi = parseInt(r.hora_inicio.split(":")[0]);
    const hf = parseInt(r.hora_fin.split(":")[0]);
    for (let h = hi; h < hf; h++) {
      if (TODAS_HORAS.includes(h)) g[r.dia]?.add(h);
    }
  }
  return g;
}

function grillaToSlots(grilla: Grilla) {
  const slots: { dia: string; hora_inicio: string; hora_fin: string }[] = [];
  for (const dia of DIAS) {
    const hours = [...grilla[dia]].sort((a, b) => a - b);
    if (!hours.length) continue;
    let start = hours[0], prev = hours[0];
    for (let i = 1; i <= hours.length; i++) {
      const curr = hours[i];
      if (curr === prev + 1) {
        prev = curr;
      } else {
        slots.push({
          dia,
          hora_inicio: `${String(start).padStart(2, "0")}:00`,
          hora_fin: `${String(prev + 1).padStart(2, "0")}:00`,
        });
        if (curr !== undefined) { start = curr; prev = curr; }
      }
    }
  }
  return slots;
}

export default function DisponibilidadPage() {
  const { data: session } = useSession();
  const [grilla, setGrilla] = useState<Grilla>(() => {
    const g: Grilla = {};
    DIAS.forEach(d => g[d] = new Set());
    return g;
  });
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regimen, setRegimen] = useState("");
  const [totalHoras, setTotalHoras] = useState(0);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const fetchDisponibilidad = useCallback(async () => {
    if (!session?.user.access_token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/docentes/me/disponibilidad`, {
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGrilla(expandRanges(data.disponibilidades));
      setTotalHoras(data.total_horas);
      setRegimen(data.regimen ?? "");
    } catch {
      setMensaje({ tipo: "error", texto: "Error al cargar la disponibilidad" });
    } finally {
      setLoading(false);
    }
  }, [session?.user.access_token]);

  useEffect(() => { fetchDisponibilidad(); }, [fetchDisponibilidad]);

  // Recalculate total hours from grilla
  const horasDeclaradas = DIAS.reduce((sum, d) => sum + grilla[d].size, 0);
  const horasRequeridas = HORAS_REQUERIDAS_LABEL[regimen] ?? 20;

  function toggleCelda(dia: string, hora: number) {
    if (!editMode) return;
    setGrilla(prev => {
      const next: Grilla = {};
      DIAS.forEach(d => next[d] = new Set(prev[d]));
      if (next[dia].has(hora)) next[dia].delete(hora);
      else next[dia].add(hora);
      return next;
    });
  }

  async function guardar() {
    if (!session?.user.access_token) return;
    setSaving(true);
    setMensaje(null);
    try {
      const slots = grillaToSlots(grilla);
      const res = await fetch(`${API}/api/docentes/me/disponibilidad`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.access_token}`,
        },
        body: JSON.stringify({ slots }),
      });
      if (!res.ok) throw new Error();
      setEditMode(false);
      setTotalHoras(horasDeclaradas);
      setMensaje({ tipo: "ok", texto: "Disponibilidad guardada correctamente." });
    } catch {
      setMensaje({ tipo: "error", texto: "Error al guardar. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">Cargando disponibilidad...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline-lg text-foreground">Mi Disponibilidad</h1>
          <p className="text-muted-foreground text-sm">Semestre 2026-I · Grilla L–V 7:00 a 20:00</p>
        </div>
        <div className="flex gap-2">
          {!editMode ? (
            <Button onClick={() => setEditMode(true)} variant="outline" className="gap-2">
              <Edit3 className="h-4 w-4" />
              Editar disponibilidad
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setEditMode(false); fetchDisponibilidad(); }}>
                Cancelar
              </Button>
              <Button onClick={guardar} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Resumen */}
      <Card className={horasDeclaradas < horasRequeridas ? "border-yellow-300 bg-yellow-50" : "border-green-300 bg-green-50"}>
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            {horasDeclaradas < horasRequeridas ? (
              <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">
                Horas declaradas: <strong>{horasDeclaradas}h</strong> / {horasRequeridas}h requeridas según tu régimen
              </span>
              <Badge variant="outline" className="text-xs">{regimen}</Badge>
              {horasDeclaradas < horasRequeridas && (
                <span className="text-yellow-700 text-xs">
                  — Se recomienda declarar al menos {horasRequeridas}h para cubrir tu carga lectiva.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {mensaje && (
        <Alert variant={mensaje.tipo === "ok" ? "success" : "destructive"}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {editMode && (
        <Alert variant="warning">
          <AlertDescription>
            <strong>Modo edición activo.</strong> Haz clic en las celdas para marcar o desmarcar disponibilidad. Presiona Guardar al terminar.
          </AlertDescription>
        </Alert>
      )}

      {/* Grilla */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Disponibilidad semanal
          </CardTitle>
          <CardDescription className="text-xs">
            Azul = disponible · Blanco = no disponible
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-20 text-right pr-3 py-2 font-medium text-muted-foreground text-xs">Hora</th>
                  {DIAS.map(d => (
                    <th key={d} className="text-center py-2 font-semibold text-gray-700 min-w-[100px]">
                      {DIAS_LABELS[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Mañana */}
                {HORAS_MANANA.map((hora) => (
                  <tr key={hora}>
                    <td className="text-right pr-3 py-0.5 text-xs text-muted-foreground font-mono">
                      {String(hora).padStart(2, "0")}:00
                    </td>
                    {DIAS.map(dia => {
                      const activo = grilla[dia].has(hora);
                      return (
                        <td key={dia} className="py-0.5 px-1 text-center">
                          <button
                            onClick={() => toggleCelda(dia, hora)}
                            disabled={!editMode}
                            className={[
                              "w-full h-8 rounded transition-all text-xs font-medium border",
                              activo
                                ? "bg-blue-100 border-blue-300 text-blue-700"
                                : "bg-white border-gray-200 text-gray-300",
                              editMode && "cursor-pointer hover:opacity-80",
                              !editMode && "cursor-default",
                            ].join(" ")}
                          >
                            {activo ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Separador almuerzo */}
                <tr>
                  <td className="text-right pr-3 py-1 text-xs text-gray-400 italic">Almuerzo</td>
                  <td colSpan={5} className="py-1">
                    <div className="h-1 bg-gradient-to-r from-orange-100 to-orange-50 rounded text-center" />
                  </td>
                </tr>
                {/* Tarde */}
                {HORAS_TARDE.map((hora) => (
                  <tr key={hora}>
                    <td className="text-right pr-3 py-0.5 text-xs text-muted-foreground font-mono">
                      {String(hora).padStart(2, "0")}:00
                    </td>
                    {DIAS.map(dia => {
                      const activo = grilla[dia].has(hora);
                      return (
                        <td key={dia} className="py-0.5 px-1 text-center">
                          <button
                            onClick={() => toggleCelda(dia, hora)}
                            disabled={!editMode}
                            className={[
                              "w-full h-8 rounded transition-all text-xs font-medium border",
                              activo
                                ? "bg-blue-100 border-blue-300 text-blue-700"
                                : "bg-white border-gray-200 text-gray-300",
                              editMode && "cursor-pointer hover:opacity-80",
                              !editMode && "cursor-default",
                            ].join(" ")}
                          >
                            {activo ? "✓" : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
