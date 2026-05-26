"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Search, BookMarked, Trash2, CheckCircle2, AlertCircle,
  Building2, FlaskConical, MapPin, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TIPO_LABELS: Record<string, string> = {
  comun: "Aula Común",
  lab_computo: "Lab. Cómputo",
  lab_redes: "Lab. Redes",
  lab_bd: "Lab. Base de Datos",
  lab_ia: "Lab. Inteligencia Artificial",
  lab_software: "Lab. Software",
  auditorio: "Auditorio",
};

const TIPO_COLORS: Record<string, string> = {
  comun: "bg-blue-50 text-blue-700 border-blue-200",
  lab_computo: "bg-purple-50 text-purple-700 border-purple-200",
  lab_redes: "bg-orange-50 text-orange-700 border-orange-200",
  lab_bd: "bg-cyan-50 text-cyan-700 border-cyan-200",
  lab_ia: "bg-pink-50 text-pink-700 border-pink-200",
  lab_software: "bg-green-50 text-green-700 border-green-200",
  auditorio: "bg-yellow-50 text-yellow-700 border-yellow-200",
};

const HORAS = Array.from({ length: 14 }, (_, i) => {
  const h = i + 7;
  return `${String(h).padStart(2, "0")}:00`;
});

type Aula = {
  id: number;
  codigo: string;
  tipo: string;
  capacidad: number;
  ubicacion: string | null;
};

type Reserva = {
  id: number;
  aula_codigo: string;
  aula_tipo: string;
  aula_ubicacion: string | null;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  motivo: string | null;
  pasada: boolean;
};

const today = new Date().toISOString().split("T")[0];

export default function RecuperacionPage() {
  const { data: session } = useSession();

  // Filter state
  const [fecha, setFecha] = useState(today);
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFin, setHoraFin] = useState("10:00");
  const [tipoAula, setTipoAula] = useState("");

  // Results state
  const [aulasDisponibles, setAulasDisponibles] = useState<Aula[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);

  // Reservation state
  const [reservando, setReservando] = useState<number | null>(null); // aula_id being booked
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  // My bookings
  const [misReservas, setMisReservas] = useState<Reserva[]>([]);
  const [cargandoReservas, setCargandoReservas] = useState(true);
  const [cancelando, setCancelando] = useState<number | null>(null);

  // Messages
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const fetchMisReservas = useCallback(async () => {
    if (!session?.user.access_token) return;
    setCargandoReservas(true);
    try {
      const res = await fetch(`${API}/api/recuperacion/mis-reservas`, {
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) throw new Error();
      setMisReservas(await res.json());
    } catch {
      // silently fail — not critical
    } finally {
      setCargandoReservas(false);
    }
  }, [session?.user.access_token]);

  useEffect(() => { fetchMisReservas(); }, [fetchMisReservas]);

  async function buscarAulas() {
    if (!session?.user.access_token) return;
    if (horaInicio >= horaFin) {
      setMensaje({ tipo: "error", texto: "La hora de inicio debe ser anterior a la hora de fin." });
      return;
    }
    setBuscando(true);
    setBuscado(false);
    setAulasDisponibles([]);
    setMensaje(null);
    setReservando(null);
    try {
      const params = new URLSearchParams({ fecha, hora_inicio: horaInicio, hora_fin: horaFin });
      if (tipoAula) params.set("tipo_aula", tipoAula);
      const res = await fetch(`${API}/api/recuperacion/aulas-disponibles?${params}`, {
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al consultar disponibilidad");
      }
      setAulasDisponibles(await res.json());
      setBuscado(true);
    } catch (e: unknown) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Error al buscar aulas" });
    } finally {
      setBuscando(false);
    }
  }

  async function reservar(aulaId: number) {
    if (!session?.user.access_token) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/recuperacion/reservas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.access_token}`,
        },
        body: JSON.stringify({
          aula_id: aulaId,
          fecha,
          hora_inicio: horaInicio,
          hora_fin: horaFin,
          motivo: motivo.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al realizar la reserva");
      }
      const data = await res.json();
      setMensaje({
        tipo: "ok",
        texto: `Reserva confirmada: ${data.aula_codigo} el ${data.fecha} de ${data.hora_inicio} a ${data.hora_fin}.`,
      });
      setReservando(null);
      setMotivo("");
      setAulasDisponibles([]);
      setBuscado(false);
      fetchMisReservas();
    } catch (e: unknown) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Error al reservar" });
    } finally {
      setGuardando(false);
    }
  }

  async function cancelarReserva(id: number) {
    if (!session?.user.access_token) return;
    setCancelando(id);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/recuperacion/reservas/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.user.access_token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? "Error al cancelar");
      }
      setMensaje({ tipo: "ok", texto: "Reserva cancelada correctamente." });
      fetchMisReservas();
    } catch (e: unknown) {
      setMensaje({ tipo: "error", texto: e instanceof Error ? e.message : "Error al cancelar" });
    } finally {
      setCancelando(null);
    }
  }

  const proximas = misReservas.filter((r) => !r.pasada);
  const pasadas = misReservas.filter((r) => r.pasada);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-headline-lg text-foreground">Clases de Recuperación</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Consulta disponibilidad de aulas y laboratorios para programar clases de recuperación.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === "ok" ? "success" : "destructive"}>
          {mensaje.tipo === "ok"
            ? <CheckCircle2 className="h-4 w-4" />
            : <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      {/* Search form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4 text-blue-600" />
            Buscar disponibilidad
          </CardTitle>
          <CardDescription className="text-xs">
            Selecciona fecha, horario y tipo de espacio para ver las opciones disponibles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fecha</label>
              <input
                type="date"
                value={fecha}
                min={today}
                onChange={(e) => { setFecha(e.target.value); setBuscado(false); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Hora inicio</label>
              <select
                value={horaInicio}
                onChange={(e) => { setHoraInicio(e.target.value); setBuscado(false); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Hora fin</label>
              <select
                value={horaFin}
                onChange={(e) => { setHoraFin(e.target.value); setBuscado(false); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {HORAS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de espacio</label>
              <select
                value={tipoAula}
                onChange={(e) => { setTipoAula(e.target.value); setBuscado(false); }}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Todos</option>
                {Object.entries(TIPO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={buscarAulas}
            disabled={buscando}
            className="mt-4 gap-2"
          >
            <Search className="h-4 w-4" />
            {buscando ? "Buscando..." : "Buscar disponibilidad"}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {buscado && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {aulasDisponibles.length === 0
              ? "Sin disponibilidad"
              : `${aulasDisponibles.length} espacio${aulasDisponibles.length !== 1 ? "s" : ""} disponible${aulasDisponibles.length !== 1 ? "s" : ""}`}
            {" "}·{" "}
            <span className="font-normal text-muted-foreground">
              {fecha} · {horaInicio}–{horaFin}
            </span>
          </h2>

          {aulasDisponibles.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No hay aulas o laboratorios disponibles para ese horario.
                <br />Prueba con otro día, rango de horas o tipo de espacio.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {aulasDisponibles.map((aula) => (
                <Card
                  key={aula.id}
                  className={`border transition-all duration-200 ${reservando === aula.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-foreground">{aula.codigo}</span>
                          <span className={`text-xs border rounded-full px-2 py-0.5 font-medium ${TIPO_COLORS[aula.tipo] ?? "bg-gray-50 text-gray-700"}`}>
                            {TIPO_LABELS[aula.tipo] ?? aula.tipo}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {aula.capacidad} estudiantes
                          </span>
                          {aula.ubicacion && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {aula.ubicacion}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {aula.tipo === "comun" || aula.tipo === "auditorio"
                          ? <Building2 className="h-6 w-6 text-blue-400" />
                          : <FlaskConical className="h-6 w-6 text-purple-400" />}
                      </div>
                    </div>

                    {reservando === aula.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={motivo}
                          onChange={(e) => setMotivo(e.target.value)}
                          placeholder="Motivo de la recuperación (opcional)..."
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => reservar(aula.id)}
                            disabled={guardando}
                            className="flex-1"
                          >
                            {guardando ? "Confirmando..." : "Confirmar reserva"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setReservando(null); setMotivo(""); }}
                            disabled={guardando}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full gap-1.5"
                        onClick={() => { setReservando(aula.id); setMotivo(""); }}
                      >
                        <BookMarked className="h-3.5 w-3.5" />
                        Reservar este espacio
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My reservations */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-primary" />
          Mis reservas
        </h2>

        {cargandoReservas ? (
          <p className="text-sm text-muted-foreground animate-pulse">Cargando reservas...</p>
        ) : misReservas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aún no tienes reservas de clases de recuperación.
            </CardContent>
          </Card>
        ) : (
          <>
            {proximas.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Próximas</p>
                {proximas.map((r) => <ReservaRow key={r.id} reserva={r} onCancelar={cancelarReserva} cancelando={cancelando} />)}
              </div>
            )}
            {pasadas.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Historial</p>
                {pasadas.map((r) => <ReservaRow key={r.id} reserva={r} onCancelar={cancelarReserva} cancelando={cancelando} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReservaRow({
  reserva,
  onCancelar,
  cancelando,
}: {
  reserva: Reserva;
  onCancelar: (id: number) => void;
  cancelando: number | null;
}) {
  const [d, mes, anio] = (() => {
    const dt = new Date(reserva.fecha + "T12:00:00");
    return [
      dt.toLocaleDateString("es-PE", { weekday: "long" }),
      dt.toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" }),
      dt.getFullYear(),
    ];
  })();
  void anio;

  return (
    <Card className={`border ${reserva.pasada ? "opacity-60" : ""}`}>
      <CardContent className="py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{reserva.aula_codigo}</span>
            <Badge variant="outline" className={`text-xs ${TIPO_COLORS[reserva.aula_tipo] ?? ""}`}>
              {TIPO_LABELS[reserva.aula_tipo] ?? reserva.aula_tipo}
            </Badge>
            {reserva.pasada && <Badge variant="secondary" className="text-xs">Pasada</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">
            {d} {mes} · {reserva.hora_inicio}–{reserva.hora_fin}
            {reserva.aula_ubicacion && ` · ${reserva.aula_ubicacion}`}
          </p>
          {reserva.motivo && (
            <p className="text-xs text-muted-foreground mt-0.5 italic">{reserva.motivo}</p>
          )}
        </div>
        {!reserva.pasada && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 flex-shrink-0"
            onClick={() => onCancelar(reserva.id)}
            disabled={cancelando === reserva.id}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {cancelando === reserva.id ? "Cancelando..." : "Cancelar"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
