import { api, type HealthResponse } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GraduationCap, Database, Server, CheckCircle2, XCircle } from "lucide-react";

async function getHealth(): Promise<HealthResponse | null> {
  try {
    return await api.get<HealthResponse>("/api/health");
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getHealth();
  const backendOk = health?.status === "ok";
  const dbOk = health?.db === "connected";

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <GraduationCap className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Generador de Horarios</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Escuela de Ingeniería de Sistemas — Universidad Nacional de Trujillo
          </p>
          <p className="text-sm text-gray-500">
            Sistema de generación automática de horarios académicos
          </p>
        </div>

        {/* Estado del sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="h-5 w-5" />
              Estado del sistema
            </CardTitle>
            <CardDescription>Diagnóstico de conectividad en tiempo real</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">Backend FastAPI</span>
                <span className="text-xs text-gray-400">localhost:8000</span>
              </div>
              {backendOk ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Sin conexión
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">PostgreSQL 17</span>
                <span className="text-xs text-gray-400">horario_unt</span>
              </div>
              {dbOk ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Conectado
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  Sin conexión
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Acceso rápido */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acceso al sistema</CardTitle>
            <CardDescription>Ingresa con tu rol institucional</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" size="lg" disabled={!backendOk}>
              <Link href="/login">
                Ingresar al sistema
              </Link>
            </Button>
            {!backendOk && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                El backend no está disponible. Inicia el servidor con{" "}
                <code className="bg-gray-100 px-1 rounded">uvicorn app.main:app --reload</code>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Info técnica */}
        <div className="text-center text-xs text-gray-400 space-y-1">
          <p>Next.js 15 · FastAPI · PostgreSQL 17 · SQLAlchemy 2.0</p>
          <p>Prototipo académico — Ciclo 2025-I</p>
        </div>
      </div>
    </main>
  );
}
