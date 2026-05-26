// Tipos y utilidades compartidas entre las vistas del horario

export type BloqueAPI = {
  id: number;
  dia: string;
  hora_inicio: string;
  hora_fin: string;
  aula: { id: number; codigo: string; tipo: string; capacidad: number };
  componente: {
    id: number;
    tipo: string;
    horas_semanales: number;
    docente: { id: number; nombre: string } | null;
    seccion: {
      id: number;
      letra: string;
      num_alumnos: number;
      curso: { id: number; codigo: string; nombre: string; ciclo: number };
    };
  };
};

export type AulaSimple = { id: number; codigo: string; tipo: string; capacidad: number };
export type DocenteSimple = { id: number; nombre: string; tipo: string };

export const DIAS = ["LUN", "MAR", "MIE", "JUE", "VIE", "SAB"] as const;
export type DiaKey = typeof DIAS[number];

export const DIAS_LABELS: Record<string, string> = {
  LUN: "Lunes", MAR: "Martes", MIE: "Miércoles", JUE: "Jueves", VIE: "Viernes", SAB: "Sábado",
};

export const HORAS_MANANA = [7, 8, 9, 10, 11, 12, 13];
export const HORAS_TARDE  = [14, 15, 16, 17, 18, 19, 20];
export const TODAS_HORAS  = [...HORAS_MANANA, ...HORAS_TARDE];

export const CICLO_ROMANO: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

export const TIPO_LABELS: Record<string, string> = { T: "Teoría", P: "Práctica", L: "Lab" };
export const TIPO_BADGES: Record<string, string> = {
  T: "bg-blue-600 text-white",
  P: "bg-green-600 text-white",
  L: "bg-purple-600 text-white",
};

// Paleta pastel — 10 colores
const BG_COLORS = [
  "#dbeafe", "#d1fae5", "#ede9fe", "#fef3c7", "#fce7f3",
  "#e0e7ff", "#ffedd5", "#ccfbf1", "#fee2e2", "#e0f2fe",
];
const BORDER_COLORS = [
  "#93c5fd", "#6ee7b7", "#c4b5fd", "#fcd34d", "#f9a8d4",
  "#a5b4fc", "#fdba74", "#5eead4", "#fca5a5", "#7dd3fc",
];
const TEXT_COLORS = [
  "#1d4ed8", "#065f46", "#5b21b6", "#92400e", "#9d174d",
  "#3730a3", "#9a3412", "#134e4a", "#991b1b", "#0c4a6e",
];

export function courseStyle(courseId: number) {
  const i = courseId % BG_COLORS.length;
  return {
    backgroundColor: BG_COLORS[i],
    borderColor: BORDER_COLORS[i],
    color: TEXT_COLORS[i],
  };
}

export function apellido(nombre: string): string {
  return nombre.split(",")[0].trim();
}

export type CellState =
  | { kind: "empty" }
  | { kind: "block"; bloque: BloqueAPI; span: number }
  | { kind: "spanned" };

export function getSpan(b: BloqueAPI): number {
  const startH = parseInt(b.hora_inicio.split(":")[0]);
  const endH   = parseInt(b.hora_fin.split(":")[0]);
  return endH - startH + 1;
}

export function buildGrid(
  bloques: BloqueAPI[],
): Record<string, Record<number, CellState>> {
  const g: Record<string, Record<number, CellState>> = {};
  DIAS.forEach(d => {
    g[d] = {};
    TODAS_HORAS.forEach(h => (g[d][h] = { kind: "empty" }));
  });

  for (const b of bloques) {
    const startH = parseInt(b.hora_inicio.split(":")[0]);
    const span   = getSpan(b);
    if (!g[b.dia] || g[b.dia][startH] === undefined) continue;
    if (g[b.dia][startH].kind === "block") continue;  // conflict — skip

    g[b.dia][startH] = { kind: "block", bloque: b, span };
    for (let h = startH + 1; h < startH + span; h++) {
      if (g[b.dia][h] !== undefined) g[b.dia][h] = { kind: "spanned" };
    }
  }
  return g;
}
