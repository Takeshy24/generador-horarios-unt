import { Cpu, GraduationCap, Info, Shield, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const RESTRICCIONES = [
  { id: "R1",  texto: "Un docente no puede estar en dos aulas simultáneamente" },
  { id: "R2",  texto: "Un aula no puede tener dos clases a la vez" },
  { id: "R3",  texto: "Alumnos del mismo ciclo no pueden tener dos componentes simultáneos (excepto labs en grupos distintos)" },
  { id: "R4",  texto: "Laboratorios se programan en el tipo de aula correcto; teoría y práctica en aula común" },
  { id: "R5",  texto: "Capacidad del aula ≥ tamaño del grupo (sección completa para T/P, grupo para L)" },
  { id: "R6",  texto: "El docente solo dicta dentro de su ventana de disponibilidad declarada" },
  { id: "R7",  texto: "Bloques de 50 minutos por hora pedagógica (Art. 10.2 Reglamento UNT)" },
  { id: "R8",  texto: "Horario L-V, mañana 7:00-13:00 y tarde 14:00-20:00 (Art. 8°-9°)" },
  { id: "R9",  texto: "Carga lectiva total del docente no excede su tope por régimen (Art. 12°)" },
  { id: "R10", texto: "Las horas semanales de cada componente se respetan exactamente" },
  { id: "R11", texto: "Cada ciclo tiene al menos 1 hora libre continua entre 12:00-14:00 cuando tiene clases en ambos turnos (hora de almuerzo)" },
];

const TECNOLOGIAS = [
  { nombre: "Next.js 15",             desc: "App Router + TypeScript" },
  { nombre: "FastAPI",                 desc: "Python async + SQLAlchemy" },
  { nombre: "PostgreSQL 17",           desc: "Base de datos relacional" },
  { nombre: "NextAuth v5",             desc: "Autenticación JWT, 4 roles" },
  { nombre: "Tailwind + shadcn/ui",    desc: "Componentes de interfaz" },
  { nombre: "Greedy + Backtracking",   desc: "Algoritmo del motor de generación" },
  { nombre: "ReportLab",               desc: "Generación de PDFs en Python" },
  { nombre: "Alembic",                 desc: "Migraciones de base de datos" },
];

export default function AcercaPage() {
  return (
    <div className="space-y-8 max-w-4xl animate-fade-in">
      <div>
        <h1 className="text-headline-lg text-foreground">Acerca del Sistema</h1>
        <p className="text-body-md text-muted-foreground mt-1">
          Sistema de Generación Automática de Horarios Académicos — UNT
        </p>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-lg bg-blue-50 p-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
            </div>
            Descripción del Proyecto
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-foreground leading-relaxed space-y-4">
          <p>
            Sistema web para la generación automática de horarios académicos de la{" "}
            <strong>Escuela de Ingeniería de Sistemas</strong> de la Universidad Nacional de Trujillo (UNT).
            Resuelve la problemática del armado manual de horarios, previniendo conflictos de aulas, docentes
            y violaciones al reglamento institucional.
          </p>
          <p>
            Implementa el flujo del <strong>Art. 13° del Reglamento N° 005-2024-INSINV/UNT</strong> para la
            Asignación de la Carga Académica Docente, con prelación nombrados-contratados-antigüedad.
            El motor greedy con backtracking asigna ~127 componentes en menos de 1 segundo.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">Prototipo académico 2026</Badge>
            <Badge variant="outline">10 ciclos · 20 docentes · 25 aulas</Badge>
            <Badge variant="outline">~127 componentes programados</Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-lg bg-green-50 p-2">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            11 Restricciones Duras Implementadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {RESTRICCIONES.map(({ id, texto }) => (
              <div key={id} className="flex items-start gap-3 text-sm">
                <span className="shrink-0 font-mono text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold mt-0.5">
                  {id}
                </span>
                <span className="text-foreground leading-snug">{texto}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-lg bg-purple-50 p-2">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            Roles del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <p className="font-semibold text-foreground">Administrador</p>
              <p className="text-xs text-muted-foreground mt-1">Mantiene catálogos: docentes, cursos y aulas</p>
            </div>
            <div className="border border-primary/20 rounded-lg p-3 bg-primary/5">
              <p className="font-semibold text-primary">Director de Escuela</p>
              <p className="text-xs text-muted-foreground mt-1">Abre el semestre, genera y publica el horario (Art. 13.1)</p>
            </div>
            <div className="border border-purple-200 rounded-lg p-3 bg-purple-50/50">
              <p className="font-semibold text-purple-700">Director de Departamento</p>
              <p className="text-xs text-muted-foreground mt-1">Asigna cursos a docentes según prelación (Art. 13.4)</p>
            </div>
            <div className="border border-green-200 rounded-lg p-3 bg-green-50/50">
              <p className="font-semibold text-green-700">Docente</p>
              <p className="text-xs text-muted-foreground mt-1">Declara disponibilidad y consulta su horario (Art. 4°-5°)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="rounded-lg bg-orange-50 p-2">
              <Cpu className="h-5 w-5 text-orange-600" />
            </div>
            Tecnologías Utilizadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TECNOLOGIAS.map(({ nombre, desc }) => (
              <div key={nombre} className="border border-border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                <p className="font-semibold text-foreground text-xs">{nombre}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5 shadow-lg">
        <CardContent className="py-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <p className="font-semibold text-foreground text-sm">Créditos</p>
          </div>
          <p className="text-sm text-foreground">
            Desarrollado por <strong>Avengers</strong> — Proyecto académico grupal
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Equipo de desarrollo · 2026
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
