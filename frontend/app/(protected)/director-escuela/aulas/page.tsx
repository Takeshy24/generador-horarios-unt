"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Check, Plus, Minus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Aula = {
  id: number;
  codigo: string;
  tipo: string;
  capacidad: number;
  ubicacion: string | null;
  disponible: boolean;
};

type Semestre = { id: number; codigo: string };

const TIPO_LABELS: Record<string, string> = {
  comun: "Aula común",
  lab_computo: "Lab. Cómputo",
  lab_redes: "Lab. Redes",
  lab_bd: "Lab. BD",
  lab_ia: "Lab. IA",
  lab_software: "Lab. Software",
  auditorio: "Auditorio",
};

const TIPO_COLORS: Record<string, string> = {
  comun: "bg-gray-100 text-gray-700",
  lab_computo: "bg-blue-100 text-blue-700",
  lab_redes: "bg-cyan-100 text-cyan-700",
  lab_bd: "bg-purple-100 text-purple-700",
  lab_ia: "bg-orange-100 text-orange-700",
  lab_software: "bg-green-100 text-green-700",
  auditorio: "bg-yellow-100 text-yellow-700",
};

const TIPO_ORDER = [
  "comun", "lab_computo", "lab_redes", "lab_bd", "lab_ia", "lab_software", "auditorio",
];

export default function AulasDisponiblesPage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [semestre, setSemestre] = useState<Semestre | null>(null);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<Set<number>>(new Set());

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

      const aulasRes = await fetch(
        `${API}/api/director/aulas-semestre?semestre_id=${sem.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!aulasRes.ok) throw new Error("Error al cargar aulas");
      setAulas(await aulasRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function toggleAula(aula: Aula) {
    if (!token || !semestre) return;
    setToggling((prev) => new Set(prev).add(aula.id));
    const endpoint = aula.disponible ? "quitar" : "agregar";
    try {
      const res = await fetch(`${API}/api/director/aulas-semestre/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ semestre_id: semestre.id, aula_id: aula.id }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      setAulas((prev) =>
        prev.map((a) => (a.id === aula.id ? { ...a, disponible: !a.disponible } : a))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al actualizar aula");
    } finally {
      setToggling((prev) => { const s = new Set(prev); s.delete(aula.id); return s; });
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Cargando...</div>;

  const byTipo = aulas.reduce<Record<string, Aula[]>>((acc, a) => {
    (acc[a.tipo] ??= []).push(a);
    return acc;
  }, {});

  const totalDisponibles = aulas.filter((a) => a.disponible).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline-lg text-foreground">Aulas Disponibles</h1>
          <p className="text-sm text-muted-foreground">
            {semestre?.codigo ?? "—"} · {totalDisponibles} de {aulas.length} aulas habilitadas
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 font-medium">
            <Check className="h-3.5 w-3.5" />
            {totalDisponibles} habilitadas
          </span>
          <span className="text-muted-foreground">{aulas.length - totalDisponibles} no habilitadas</span>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Activa o desactiva cada aula para incluirla en el pool disponible para la generación del horario.
      </p>

      {TIPO_ORDER.filter((t) => byTipo[t]?.length).map((tipo) => {
        const lista = byTipo[tipo];
        const habilitadas = lista.filter((a) => a.disponible).length;

        return (
          <div key={tipo}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                {TIPO_LABELS[tipo]}
              </h2>
              <span className="text-xs text-muted-foreground">
                {habilitadas}/{lista.length} habilitadas
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-border">
                  <tr>
                    {["Código", "Tipo", "Capacidad", "Ubicación", "Estado"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium text-gray-600">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((aula) => {
                    const isToggling = toggling.has(aula.id);
                    return (
                      <tr
                        key={aula.id}
                        className={`border-b last:border-0 transition-colors ${
                          aula.disponible ? "hover:bg-green-50/40" : "hover:bg-gray-50 opacity-70"
                        }`}
                      >
                        <td className="px-4 py-2.5 font-mono font-medium">{aula.codigo}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TIPO_COLORS[aula.tipo]}`}
                          >
                            {TIPO_LABELS[aula.tipo]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{aula.capacidad} alumnos</td>
                        <td className="px-4 py-2.5 text-gray-500">{aula.ubicacion ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          <Button
                            size="sm"
                            variant={aula.disponible ? "default" : "outline"}
                            disabled={isToggling}
                            onClick={() => toggleAula(aula)}
                            className={
                              aula.disponible
                                ? "bg-green-600 hover:bg-green-700 text-white h-7 text-xs px-2.5"
                                : "h-7 text-xs px-2.5"
                            }
                          >
                            {isToggling ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : aula.disponible ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Habilitada
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3 mr-1" />
                                Habilitar
                              </>
                            )}
                          </Button>
                          {aula.disponible && !isToggling && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleAula(aula)}
                              className="ml-1 h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {aulas.length === 0 && (
        <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-muted-foreground text-sm">
          No hay aulas registradas en el sistema
        </div>
      )}
    </div>
  );
}
