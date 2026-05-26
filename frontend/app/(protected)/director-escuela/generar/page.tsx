"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Play, RefreshCw, AlertTriangle, CheckCircle2, XCircle,
  Info, Loader2, ChevronDown, ChevronUp, BookOpen, Users, Building2,
  Clock, Package, Share2, Download, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { VistaPorCiclo }    from "@/components/horario/VistaPorCiclo";
import { VistaPorDocente }  from "@/components/horario/VistaPorDocente";
import { VistaPorAula }     from "@/components/horario/VistaPorAula";
import { CICLO_ROMANO }     from "@/lib/horario-utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type SemestreInfo = {
  id: number;
  codigo: string;
  total_componentes: number;
  con_docente: number;
  sin_docente: number;
  estado: string;
};

type Infactible = {
  componente_id: number;
  curso_nombre: string;
  ciclo: number;
  tipo_componente: string;
  causa: string;
  sugerencias: string[];
  restriccion_principal: string;
  docente_nombre: string;
  seccion_letra: string;
};

type ResultadoGeneracion = {
  exitoso: boolean;
  total_componentes: number;
  componentes_colocados: number;
  porcentaje_colocado: number;
  tiempo_segundos: number;
  infactibles: Infactible[];
  advertencias: string[];
};

type PreValidacion = {
  semestre_id: number;
  total_componentes: number;
  con_docente: number;
  sin_docente: number;
  errores: { categoria: string; mensaje: string; sugerencias: string[] }[];
  advertencias: { categoria: string; mensaje: string; sugerencias: string[] }[];
  puede_generar: boolean;
};

type Pendiente = {
  componente_id: number;
  curso_nombre: string;
  ciclo: number;
  tipo: string;
  seccion_letra: string;
  docente_nombre: string;
};

type TabId = "ciclo" | "docente" | "aula";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJSON<T>(url: string, token: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as T;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-blue-50 text-blue-600">{icon}</div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

const RESTRICCION_LABEL: Record<string, string> = {
  R1:  "conflicto de docente",
  R2:  "conflicto de aula",
  R3:  "conflicto de ciclo",
  R4:  "tipo de aula",
  R5:  "capacidad insuficiente",
  R6:  "disponibilidad del docente",
  R9:  "tope de carga",
  R11: "hora de almuerzo",
  ORDEN: "orden de prioridad (regenerar)",
};

function InfactibleRow({ inf, open, toggle }: {
  inf: Infactible; open: boolean; toggle: () => void;
}) {
  const tipoCls: Record<string, string> = {
    T: "bg-blue-100 text-blue-700",
    P: "bg-green-100 text-green-700",
    L: "bg-purple-100 text-purple-700",
  };
  const showDispoLink = ["R1", "R6", "R9"].includes(inf.restriccion_principal);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${tipoCls[inf.tipo_componente] ?? "bg-gray-100 text-gray-700"}`}>
            {inf.tipo_componente}
          </span>
          <span className="text-sm font-medium truncate">{inf.curso_nombre}</span>
          {inf.docente_nombre && (
            <span className="text-xs text-muted-foreground truncate hidden sm:inline shrink-0">
              · {inf.docente_nombre.split(",")[0]}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="border-t bg-red-50 p-3 space-y-2">
          {inf.restriccion_principal && !["DESCONOCIDO", ""].includes(inf.restriccion_principal) && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-bold">
                {inf.restriccion_principal}
              </span>
              <span className="text-xs text-red-600">
                {RESTRICCION_LABEL[inf.restriccion_principal] ?? inf.restriccion_principal}
              </span>
            </div>
          )}
          <p className="text-sm text-red-700 flex items-start gap-1.5">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
            {inf.causa}
          </p>
          {inf.sugerencias.length > 0 && (
            <ul className="space-y-1 pl-6">
              {inf.sugerencias.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground list-disc">{s}</li>
              ))}
            </ul>
          )}
          {showDispoLink && (
            <div className="pt-1 border-t border-red-100">
              <a
                href="/director-depto/disponibilidades"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Ver disponibilidades de docentes →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreValidacionModal({ open, onClose, data }: {
  open: boolean; onClose: () => void; data: PreValidacion | null;
}) {
  if (!data) return null;
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            Pre-validación del Semestre
          </DialogTitle>
          <DialogDescription>
            {data.total_componentes} componentes · {data.con_docente} con docente · {data.sin_docente} sin docente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {data.puede_generar ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">El semestre puede ser generado</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
              <XCircle className="h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">Existen errores que impiden la generación</span>
            </div>
          )}

          {data.errores.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-700">Errores ({data.errores.length})</p>
              {data.errores.map((e, i) => (
                <div key={i} className="border border-red-200 rounded-lg p-3 bg-red-50">
                  <p className="text-xs font-medium text-red-600 uppercase tracking-wide">{e.categoria}</p>
                  <p className="text-sm text-red-800 mt-0.5">{e.mensaje}</p>
                  {e.sugerencias.length > 0 && (
                    <ul className="mt-1 pl-4 space-y-0.5">
                      {e.sugerencias.map((s, j) => (
                        <li key={j} className="text-xs text-red-600 list-disc">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.advertencias.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-yellow-700">Advertencias ({data.advertencias.length})</p>
              {data.advertencias.map((a, i) => (
                <div key={i} className="border border-yellow-200 rounded-lg p-3 bg-yellow-50">
                  <p className="text-xs font-medium text-yellow-600 uppercase tracking-wide">{a.categoria}</p>
                  <p className="text-sm text-yellow-800 mt-0.5">{a.mensaje}</p>
                  {a.sugerencias.length > 0 && (
                    <ul className="mt-1 pl-4 space-y-0.5">
                      {a.sugerencias.map((s, j) => (
                        <li key={j} className="text-xs text-yellow-600 list-disc">{s}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {data.errores.length === 0 && data.advertencias.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No se encontraron problemas. El semestre está listo para generar.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PendientesModal({ open, onClose, pendientes, semestreId, token }: {
  open: boolean;
  onClose: () => void;
  pendientes: Pendiente[];
  semestreId: number;
  token: string;
}) {
  const tipoCls: Record<string, string> = {
    T: "bg-blue-100 text-blue-700",
    P: "bg-green-100 text-green-700",
    L: "bg-purple-100 text-purple-700",
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-yellow-600" />
            Componentes pendientes ({pendientes.length})
          </DialogTitle>
          <DialogDescription>
            Estos componentes no tienen bloque asignado en el horario actual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {pendientes.length === 0 ? (
            <p className="text-sm text-center text-muted-foreground py-6">
              No hay componentes pendientes. Todos fueron colocados correctamente.
            </p>
          ) : (
            pendientes.map(p => (
              <div key={p.componente_id} className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tipoCls[p.tipo] ?? "bg-gray-100 text-gray-700"}`}>
                    {p.tipo}
                  </span>
                  <span className="text-sm font-medium">{p.curso_nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    Ciclo {CICLO_ROMANO[p.ciclo] ?? p.ciclo} · Sec.{p.seccion_letra}
                  </span>
                </div>
                {p.docente_nombre && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Docente: {p.docente_nombre.split(",")[0]}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

type PageState = "loading" | "idle" | "generating" | "done";

export default function GenerarHorarioPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pageState,      setPageState]      = useState<PageState>("loading");
  const [semestre,       setSemestre]       = useState<SemestreInfo | null>(null);
  const [resultado,      setResultado]      = useState<ResultadoGeneracion | null>(null);
  const [preVal,         setPreVal]         = useState<PreValidacion | null>(null);
  const [showPreVal,     setShowPreVal]     = useState(false);
  const [loadingPreVal,  setLoadingPreVal]  = useState(false);
  const [activeTab,      setActiveTab]      = useState<TabId>("ciclo");
  const [cicloActivo,    setCicloActivo]    = useState(7);
  const [openInfactibles, setOpenInfactibles] = useState<Set<number>>(new Set());
  const [error,          setError]          = useState<string | null>(null);
  const hasMounted = useRef(false);

  // Publicar / despublicar
  const [showPublicarModal, setShowPublicarModal] = useState(false);
  const [loadingPublicar,   setLoadingPublicar]   = useState(false);
  const [downloadingPdf,    setDownloadingPdf]    = useState(false);
  const [downloadingXlsx,   setDownloadingXlsx]   = useState(false);

  // Banner de pendientes
  const [pendientes,       setPendientes]       = useState<Pendiente[]>([]);
  const [showPendientes,   setShowPendientes]   = useState(false);
  const [loadingPendientes, setLoadingPendientes] = useState(false);

  // Redirigir si no es director_escuela
  useEffect(() => {
    if (status === "loading") return;
    if (!session) { router.replace("/login"); return; }
    if (session.user.role !== "director_escuela") { router.replace("/"); return; }
  }, [session, status, router]);

  // Carga inicial
  const cargarEstadoInicial = useCallback(async () => {
    if (!session?.user?.access_token) return;
    const token = session.user.access_token;
    try {
      const sem = await fetchJSON<{ id: number; codigo: string; estado: string }>(
        `${API}/api/semestres/activo`, token
      );
      let preValData: PreValidacion | null = null;
      try {
        preValData = await fetchJSON<PreValidacion>(
          `${API}/api/horario/pre-validar?semestre_id=${sem.id}`, token
        );
      } catch { /* sin bloquear */ }

      setSemestre({
        id: sem.id,
        codigo: sem.codigo,
        total_componentes: preValData?.total_componentes ?? 0,
        con_docente: preValData?.con_docente ?? 0,
        sin_docente: preValData?.sin_docente ?? 0,
        estado: sem.estado ?? "generando",
      });

      try {
        const existing = await fetchJSON<{ total_bloques: number; bloques: unknown[] }>(
          `${API}/api/horario/semestre/${sem.id}`, token
        );
        if (existing.total_bloques > 0) {
          setResultado({
            exitoso: true,
            total_componentes: preValData?.total_componentes ?? 0,
            componentes_colocados: existing.total_bloques,
            porcentaje_colocado: preValData
              ? Math.round((existing.total_bloques / preValData.total_componentes) * 100)
              : 0,
            tiempo_segundos: 0,
            infactibles: [],
            advertencias: ["Horario cargado desde la base de datos (generado previamente)."],
          });
          setPageState("done");
          // Cargar pendientes en background
          cargarPendientes(sem.id, token);
          return;
        }
      } catch { /* no existe aún */ }

      setPageState("idle");
    } catch {
      setError("No se pudo cargar el semestre activo.");
      setPageState("idle");
    }
  }, [session]);

  useEffect(() => {
    if (status === "authenticated" && !hasMounted.current) {
      hasMounted.current = true;
      cargarEstadoInicial();
    }
  }, [status, cargarEstadoInicial]);

  const cargarPendientes = async (semestreId: number, token: string) => {
    setLoadingPendientes(true);
    try {
      const data = await fetchJSON<{ total: number; pendientes: Pendiente[] }>(
        `${API}/api/horario/semestre/${semestreId}/pendientes`, token
      );
      setPendientes(data.pendientes);
    } catch { /* silencioso */ } finally {
      setLoadingPendientes(false);
    }
  };

  const handleGenerar = async () => {
    if (!session?.user?.access_token || !semestre) return;
    setPageState("generating");
    setError(null);
    setPendientes([]);
    try {
      const res = await fetchJSON<ResultadoGeneracion>(
        `${API}/api/horario/generar?semestre_id=${semestre.id}`,
        session.user.access_token,
        { method: "POST", body: JSON.stringify({ reiniciar: true }) }
      );
      setResultado(res);
      setPageState("done");
      // Cargar pendientes (componentes sin colocar)
      cargarPendientes(semestre.id, session.user.access_token);
    } catch (e) {
      setError(`Error al generar: ${e instanceof Error ? e.message : String(e)}`);
      setPageState("idle");
    }
  };

  const handlePublicar = async () => {
    if (!session?.user?.access_token || !semestre) return;
    setLoadingPublicar(true);
    try {
      await fetchJSON<{ ok: boolean }>(
        `${API}/api/horario/publicar?semestre_id=${semestre.id}`,
        session.user.access_token,
        { method: "POST" }
      );
      setSemestre(s => s ? { ...s, estado: "publicado" } : s);
      setShowPublicarModal(false);
    } catch (e) {
      setError(`Error al publicar: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingPublicar(false);
    }
  };

  const handleDespublicar = async () => {
    if (!session?.user?.access_token || !semestre) return;
    try {
      await fetchJSON<{ ok: boolean }>(
        `${API}/api/horario/despublicar?semestre_id=${semestre.id}`,
        session.user.access_token,
        { method: "POST" }
      );
      setSemestre(s => s ? { ...s, estado: "generando" } : s);
    } catch (e) {
      setError(`Error al despublicar: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleDescargarPdf = async (tipo: "ciclo" | "completo", cicloNum?: number) => {
    if (!session?.user?.access_token || !semestre) return;
    setDownloadingPdf(true);
    const base = `${API}/api/horario/pdf`;
    let url = tipo === "ciclo"
      ? `${base}/ciclo/${cicloNum}?semestre_id=${semestre.id}`
      : `${base}/completo?semestre_id=${semestre.id}`;
    const filename = tipo === "ciclo"
      ? `horario_ciclo${cicloNum}_${semestre.codigo}.pdf`
      : `horario_completo_${semestre.codigo}.pdf`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(`Error al descargar PDF: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDescargarExcel = async (tipo: "ciclo" | "completo", cicloNum?: number) => {
    if (!session?.user?.access_token || !semestre) return;
    setDownloadingXlsx(true);
    const base = `${API}/api/horario/excel`;
    const url = tipo === "ciclo"
      ? `${base}/ciclo/${cicloNum}?semestre_id=${semestre.id}`
      : `${base}/completo?semestre_id=${semestre.id}`;
    const filename = tipo === "ciclo"
      ? `horario_ciclo${cicloNum}_${semestre.codigo}.xlsx`
      : `horario_completo_${semestre.codigo}.xlsx`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setError(`Error al descargar Excel: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const handlePreValidar = async () => {
    if (!session?.user?.access_token || !semestre) return;
    setLoadingPreVal(true);
    try {
      const data = await fetchJSON<PreValidacion>(
        `${API}/api/horario/pre-validar?semestre_id=${semestre.id}`,
        session.user.access_token
      );
      setPreVal(data);
      setShowPreVal(true);
    } catch (e) {
      setError(`Error en pre-validación: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingPreVal(false);
    }
  };

  const toggleInfactible = (id: number) => {
    setOpenInfactibles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Estados de carga ────────────────────────────────────────────────────────
  if (status === "loading" || pageState === "loading") {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Cargando...</span>
      </div>
    );
  }

  const semestreCodigo = semestre?.codigo ?? "2026-I";

  // ── Estado: Generando ───────────────────────────────────────────────────────
  if (pageState === "generating") {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900">Generando horario...</p>
          <p className="text-muted-foreground text-sm mt-1">
            El motor greedy está asignando {semestre?.total_componentes ?? "..."} componentes.
          </p>
          <p className="text-muted-foreground text-xs mt-1">Esto tarda menos de 1 segundo.</p>
        </div>
      </div>
    );
  }

  // ── Estado: Idle ────────────────────────────────────────────────────────────
  if (pageState === "idle") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-headline-lg text-foreground">Generar Horario</h1>
          <p className="text-muted-foreground text-sm">Semestre {semestreCodigo} · Motor greedy con 11 restricciones</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {semestre && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
              icon={<BookOpen className="h-5 w-5" />}
              label="Componentes a programar"
              value={semestre.total_componentes}
              sub="teorías, prácticas y labs"
            />
            <StatCard
              icon={<Users className="h-5 w-5" />}
              label="Con docente asignado"
              value={semestre.con_docente}
              sub={`${semestre.sin_docente} sin asignar`}
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" />}
              label="Semestre activo"
              value={semestre.codigo}
              sub={`ID: ${semestre.id}`}
            />
          </div>
        )}

        <Card className="border-blue-200">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Generación de Horario — {semestreCodigo}</CardTitle>
            <p className="text-sm text-muted-foreground">
              El motor asigna automáticamente aulas, horarios y verifica conflictos de docentes,
              disponibilidad, hora de almuerzo y capacidad de aulas.
            </p>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleGenerar}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 px-6"
              size="lg"
            >
              <Play className="h-5 w-5" />
              Generar Horario
            </Button>
            <Button
              variant="outline"
              onClick={handlePreValidar}
              disabled={loadingPreVal}
              className="flex items-center gap-2"
              size="lg"
            >
              {loadingPreVal
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Info className="h-4 w-4" />}
              Ver pre-validación
            </Button>
          </CardContent>
        </Card>

        <PreValidacionModal open={showPreVal} onClose={() => setShowPreVal(false)} data={preVal} />
      </div>
    );
  }

  // ── Estado: Done ────────────────────────────────────────────────────────────
  const res = resultado!;
  const pct = Math.round(res.porcentaje_colocado);
  const isSuccess = pct >= 90;

  const ciclosConConflictos = Object.entries(
    res.infactibles.reduce((acc, inf) => {
      acc[inf.ciclo] = (acc[inf.ciclo] ?? 0) + 1;
      return acc;
    }, {} as Record<number, number>)
  )
    .map(([ciclo, count]) => ({ ciclo: Number(ciclo), count }))
    .sort((a, b) => a.ciclo - b.ciclo);

  const infactiblesFiltrados = res.infactibles.filter(inf => inf.ciclo === cicloActivo);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-headline-lg text-foreground">Horario Generado</h1>
          <p className="text-muted-foreground text-sm">Semestre {semestreCodigo}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón Publicar / banner Publicado */}
          {semestre?.estado === "publicado" ? (
            <>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Horario publicado
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDespublicar}
                className="text-yellow-700 border-yellow-300 hover:bg-yellow-50"
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Despublicar
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setShowPublicarModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
              size="sm"
            >
              <Share2 className="h-4 w-4" />
              Publicar Horario
            </Button>
          )}

          {/* Descarga PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDescargarPdf("ciclo", cicloActivo)}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5"
          >
            {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF Ciclo {CICLO_ROMANO[cicloActivo]}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDescargarPdf("completo")}
            disabled={downloadingPdf}
            className="flex items-center gap-1.5"
          >
            {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF Completo
          </Button>

          {/* Descarga Excel */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDescargarExcel("ciclo", cicloActivo)}
            disabled={downloadingXlsx}
            className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
          >
            {downloadingXlsx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Excel Ciclo {CICLO_ROMANO[cicloActivo]}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDescargarExcel("completo")}
            disabled={downloadingXlsx}
            className="flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
          >
            {downloadingXlsx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Excel Completo
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPageState("idle"); setResultado(null); setPendientes([]); }}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Regenerar
          </Button>
        </div>
      </div>

      {/* Banner resultado */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${
        isSuccess ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
      }`}>
        {isSuccess
          ? <CheckCircle2 className="h-8 w-8 text-green-600 shrink-0" />
          : <AlertTriangle className="h-8 w-8 text-yellow-600 shrink-0" />}
        <div className="flex-1">
          <p className={`text-lg font-semibold ${isSuccess ? "text-green-800" : "text-yellow-800"}`}>
            {res.componentes_colocados} / {res.total_componentes} componentes colocados ({pct}%)
          </p>
          <p className={`text-sm ${isSuccess ? "text-green-700" : "text-yellow-700"}`}>
            {res.tiempo_segundos > 0 && `Tiempo: ${res.tiempo_segundos.toFixed(3)}s · `}
            {res.infactibles.length > 0 && `${res.infactibles.length} infactibles`}
          </p>
        </div>
        {res.tiempo_segundos === 0 && (
          <Badge variant="outline" className="text-xs">desde BD</Badge>
        )}
      </div>

      {/* Banner de componentes pendientes */}
      {(pendientes.length > 0 || loadingPendientes) && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 border border-yellow-300">
          <Package className="h-5 w-5 text-yellow-600 shrink-0" />
          <div className="flex-1">
            {loadingPendientes ? (
              <span className="text-sm text-yellow-700 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando componentes pendientes…
              </span>
            ) : (
              <span className="text-sm font-medium text-yellow-800">
                {pendientes.length} componente{pendientes.length !== 1 ? "s" : ""} sin asignar en el horario
              </span>
            )}
          </div>
          {!loadingPendientes && pendientes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="border-yellow-400 text-yellow-700 hover:bg-yellow-100 shrink-0"
              onClick={() => setShowPendientes(true)}
            >
              Ver pendientes
            </Button>
          )}
        </div>
      )}

      {/* Advertencias del motor */}
      {res.advertencias.length > 0 && (
        <div className="space-y-1.5">
          {res.advertencias.map((adv, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-500" />
              {adv}
            </div>
          ))}
        </div>
      )}

      {/* Panel de infactibles */}
      {res.infactibles.length > 0 && (
        <div className="space-y-3">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />
              <span className="text-sm font-semibold text-yellow-800">
                {res.infactibles.length} componente(s) sin colocar — selecciona un ciclo para ver el detalle
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              {ciclosConConflictos.map(({ ciclo, count }) => (
                <button
                  key={ciclo}
                  onClick={() => setCicloActivo(ciclo)}
                  className={[
                    "text-xs px-2.5 py-1 rounded font-semibold border transition-colors",
                    cicloActivo === ciclo
                      ? "bg-yellow-600 border-yellow-600 text-white"
                      : "bg-white border-yellow-300 text-yellow-700 hover:bg-yellow-100",
                  ].join(" ")}
                >
                  {CICLO_ROMANO[ciclo] ?? `Ciclo ${ciclo}`} ({count})
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              Ciclo {CICLO_ROMANO[cicloActivo] ?? cicloActivo} —{" "}
              {infactiblesFiltrados.length === 0
                ? "sin conflictos"
                : `${infactiblesFiltrados.length} componente(s) sin colocar`}
            </p>
            {infactiblesFiltrados.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Sin conflictos para el ciclo {CICLO_ROMANO[cicloActivo] ?? cicloActivo}
              </div>
            ) : (
              infactiblesFiltrados.map(inf => (
                <InfactibleRow
                  key={inf.componente_id}
                  inf={inf}
                  open={openInfactibles.has(inf.componente_id)}
                  toggle={() => toggleInfactible(inf.componente_id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Tabs de vistas */}
      <div>
        <div className="flex border-b mb-4">
          {(["ciclo", "docente", "aula"] as TabId[]).map(tab => {
            const labels: Record<TabId, string> = {
              ciclo:   "Por Ciclo",
              docente: "Por Docente",
              aula:    "Por Aula",
            };
            const icons: Record<TabId, React.ReactNode> = {
              ciclo:   <BookOpen className="h-4 w-4" />,
              docente: <Users className="h-4 w-4" />,
              aula:    <Building2 className="h-4 w-4" />,
            };
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-muted-foreground hover:text-gray-700"
                }`}
              >
                {icons[tab]}
                {labels[tab]}
              </button>
            );
          })}
        </div>

        {activeTab === "ciclo" && semestre && (
          <VistaPorCiclo
            semestreId={semestre.id}
            ciclo={cicloActivo}
            onCicloChange={setCicloActivo}
          />
        )}
        {activeTab === "docente" && semestre && (
          <VistaPorDocente semestreId={semestre.id} />
        )}
        {activeTab === "aula" && semestre && (
          <VistaPorAula semestreId={semestre.id} />
        )}
      </div>

      {/* Modales */}
      <PreValidacionModal open={showPreVal} onClose={() => setShowPreVal(false)} data={preVal} />
      {semestre && (
        <PendientesModal
          open={showPendientes}
          onClose={() => setShowPendientes(false)}
          pendientes={pendientes}
          semestreId={semestre.id}
          token={session?.user?.access_token ?? ""}
        />
      )}

      {/* Modal confirmación publicar */}
      <Dialog open={showPublicarModal} onOpenChange={v => { if (!v) setShowPublicarModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-green-600" />
              Publicar el horario
            </DialogTitle>
            <DialogDescription>
              Al publicar, los docentes podrán ver y descargar su horario personal del semestre {semestreCodigo}.
              Puedes despublicar en cualquier momento para seguir editando.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowPublicarModal(false)} disabled={loadingPublicar}>
              Cancelar
            </Button>
            <Button
              onClick={handlePublicar}
              disabled={loadingPublicar}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              {loadingPublicar && <Loader2 className="h-4 w-4 animate-spin" />}
              Sí, publicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
