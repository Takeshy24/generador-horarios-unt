import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Users, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type DocenteCarga = {
  docente_id: number;
  nombre: string;
  tipo: string;
  regimen: string;
  categoria: string | null;
  antiguedad_anos: number;
  tope_horas: number;
  horas_asignadas: number;
  horas_disponibles: number;
  estado: "ok" | "bajo_carga" | "sobrecarga" | "disponibilidad_insuficiente";
};

async function getResumenCargas(token: string, semestreId: number): Promise<DocenteCarga[]> {
  try {
    const res = await fetch(
      `${API}/api/asignaciones/resumen-cargas?semestre_id=${semestreId}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function getSemestreId(token: string): Promise<number> {
  try {
    const res = await fetch(`${API}/api/semestres/activo`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const d = await res.json();
    return d.id;
  } catch {
    return 1;
  }
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    ok: {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      label: "OK",
      cls: "bg-green-100 text-green-700 border-green-200",
    },
    bajo_carga: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: "Bajo carga",
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200",
    },
    sobrecarga: {
      icon: <XCircle className="h-3.5 w-3.5" />,
      label: "Sobrecarga",
      cls: "bg-red-100 text-red-700 border-red-200",
    },
    disponibilidad_insuficiente: {
      icon: <AlertCircle className="h-3.5 w-3.5" />,
      label: "Disp. insuficiente",
      cls: "bg-orange-100 text-orange-700 border-orange-200",
    },
  };
  const { icon, label, cls } = cfg[estado] ?? cfg.ok;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {icon}
      {label}
    </span>
  );
}

function BarraCarga({ asignadas, tope }: { asignadas: number; tope: number }) {
  const pct = tope > 0 ? Math.min(100, Math.round((asignadas / tope) * 100)) : 0;
  const indicatorClass =
    pct >= 100 ? "[&>div]:bg-red-500" :
    pct >= 80  ? "[&>div]:bg-yellow-500" :
    "[&>div]:bg-green-500";

  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <Progress value={pct} className={`h-2 flex-1 ${indicatorClass}`} />
      <span className="text-xs text-muted-foreground font-mono w-14 text-right">
        {asignadas}/{tope}h
      </span>
    </div>
  );
}

export default async function ResumenCargasPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const semestreId = await getSemestreId(session.user.access_token);
  const docentes = await getResumenCargas(session.user.access_token, semestreId);

  const nombrados = docentes.filter(d => d.tipo === "nombrado");
  const contratados = docentes.filter(d => d.tipo === "contratado");
  const sinCarga = docentes.filter(d => d.estado === "bajo_carga").length;
  const sobrecargados = docentes.filter(d => d.estado === "sobrecarga").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline-lg text-foreground">Resumen de Cargas</h1>
          <p className="text-muted-foreground text-sm">
            Semestre 2026-I · distribución de carga horaria lectiva
          </p>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Total docentes</p>
            <p className="text-3xl font-bold">{docentes.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {nombrados.length} nom · {contratados.length} cont
            </p>
          </CardContent>
        </Card>
        <Card className={sobrecargados > 0 ? "border-red-200" : ""}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Sobrecarga</p>
            <p className={`text-3xl font-bold ${sobrecargados > 0 ? "text-red-600" : "text-green-600"}`}>
              {sobrecargados}
            </p>
            <p className="text-xs text-muted-foreground mt-1">docentes sobre el tope</p>
          </CardContent>
        </Card>
        <Card className={sinCarga > 0 ? "border-yellow-200" : ""}>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Sin asignación</p>
            <p className={`text-3xl font-bold ${sinCarga > 0 ? "text-yellow-600" : "text-gray-400"}`}>
              {sinCarga}
            </p>
            <p className="text-xs text-muted-foreground mt-1">docentes sin cursos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">Estado OK</p>
            <p className="text-3xl font-bold text-green-600">
              {docentes.filter(d => d.estado === "ok").length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">docentes con carga normal</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla nombrados */}
      <TablaDocentes titulo="Docentes Nombrados" docentes={nombrados} />

      {/* Tabla contratados */}
      <TablaDocentes titulo="Docentes Contratados" docentes={contratados} />
    </div>
  );
}

function TablaDocentes({ titulo, docentes }: { titulo: string; docentes: DocenteCarga[] }) {
  if (!docentes.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          {titulo} ({docentes.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Régimen</TableHead>
              <TableHead className="text-center">Antigüedad</TableHead>
              <TableHead>Carga horaria</TableHead>
              <TableHead className="text-center">Disponib.</TableHead>
              <TableHead className="text-center">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docentes.map(d => (
              <TableRow key={d.docente_id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{d.nombre}</p>
                    {d.categoria && (
                      <p className="text-xs text-muted-foreground capitalize">{d.categoria}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{d.regimen}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm">{d.antiguedad_anos} años</span>
                </TableCell>
                <TableCell>
                  <BarraCarga asignadas={d.horas_asignadas} tope={d.tope_horas} />
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-sm font-mono">{d.horas_disponibles}h</span>
                </TableCell>
                <TableCell className="text-center">
                  <EstadoBadge estado={d.estado} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
