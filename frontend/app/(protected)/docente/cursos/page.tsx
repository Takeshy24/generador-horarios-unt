import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TIPO_LABELS: Record<string, string> = { T: "Teoría", P: "Práctica", L: "Laboratorio" };
const TIPO_COLORS: Record<string, string> = {
  T: "bg-blue-100 text-blue-700 border-blue-200",
  P: "bg-green-100 text-green-700 border-green-200",
  L: "bg-purple-100 text-purple-700 border-purple-200",
};

type Componente = {
  id: number;
  curso_nombre: string;
  ciclo: number;
  seccion_letra: string;
  tipo: "T" | "P" | "L";
  horas_semanales: number;
  grupo_numero: number | null;
};

async function getMisComponentes(token: string): Promise<Componente[]> {
  try {
    const res = await fetch(`${API}/api/docentes/me/componentes`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function MisCursosPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const componentes = await getMisComponentes(session.user.access_token);

  const totalHoras = componentes.reduce((s, c) => s + c.horas_semanales, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-headline-lg text-foreground">Mis Cursos Asignados</h1>
          <p className="text-muted-foreground text-sm">Semestre 2026-I · componentes T/P/L a tu cargo</p>
        </div>
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="text-sm">{componentes.length} componentes</Badge>
          <Badge className="text-sm bg-blue-600">{totalHoras}h / semana</Badge>
        </div>
      </div>

      {componentes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No tienes componentes asignados en el semestre 2026-I.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-green-600" />
              Detalle de componentes
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Curso</TableHead>
                  <TableHead className="text-center">Ciclo</TableHead>
                  <TableHead className="text-center">Sección</TableHead>
                  <TableHead className="text-center">Componente</TableHead>
                  <TableHead className="text-center">Horas / sem</TableHead>
                  <TableHead className="text-center">Grupo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {componentes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.curso_nombre}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{c.ciclo}°</Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">{c.seccion_letra}</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border ${TIPO_COLORS[c.tipo]}`}>
                        {TIPO_LABELS[c.tipo]} ({c.tipo})
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{c.horas_semanales}h</TableCell>
                    <TableCell className="text-center text-muted-foreground text-sm">
                      {c.grupo_numero ? `Grupo ${c.grupo_numero}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Resumen por tipo */}
      {componentes.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {(["T", "P", "L"] as const).map(tipo => {
            const items = componentes.filter(c => c.tipo === tipo);
            const horas = items.reduce((s, c) => s + c.horas_semanales, 0);
            return (
              <Card key={tipo} className="text-center">
                <CardContent className="py-4">
                  <span className={`inline-block px-3 py-1 rounded text-sm font-semibold border mb-2 ${TIPO_COLORS[tipo]}`}>
                    {TIPO_LABELS[tipo]}
                  </span>
                  <p className="text-2xl font-bold">{items.length}</p>
                  <p className="text-xs text-muted-foreground">{horas}h/sem</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
