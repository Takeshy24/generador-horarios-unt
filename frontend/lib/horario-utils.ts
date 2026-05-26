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
  | { kind: "block"; bloques: BloqueAPI[]; span: number }
  | { kind: "spanned" };

export function getSpan(b: BloqueAPI): number {
  const startH = parseInt(b.hora_inicio.split(":")[0]);
  const endH   = parseInt(b.hora_fin.split(":")[0]);
  return endH - startH + 1;
}

function bloquesSeSuperponen(b1: BloqueAPI, b2: BloqueAPI): boolean {
  if (b1.dia !== b2.dia) return false;
  const s1 = parseInt(b1.hora_inicio.split(":")[0]);
  const e1 = parseInt(b1.hora_fin.split(":")[0]);
  const s2 = parseInt(b2.hora_inicio.split(":")[0]);
  const e2 = parseInt(b2.hora_fin.split(":")[0]);
  return !(e1 < s2 || e2 < s1);
}

export function buildGrid(
  bloques: BloqueAPI[],
): Record<string, Record<number, CellState>> {
  const g: Record<string, Record<number, CellState>> = {};
  DIAS.forEach(d => {
    g[d] = {};
    TODAS_HORAS.forEach(h => (g[d][h] = { kind: "empty" }));
  });

  const procesados = new Set<number>();

  for (const b of bloques) {
    if (procesados.has(b.id)) continue;
    const startH = parseInt(b.hora_inicio.split(":")[0]);
    const span = getSpan(b);

    const bloquesParalelos: BloqueAPI[] = [b];
    procesados.add(b.id);

    for (const otro of bloques) {
      if (procesados.has(otro.id)) continue;
      if (bloquesSeSuperponen(b, otro)) {
        bloquesParalelos.push(otro);
        procesados.add(otro.id);
      }
    }

    if (!g[b.dia] || g[b.dia][startH] === undefined) continue;
    if (g[b.dia][startH].kind !== "empty") continue;

    g[b.dia][startH] = { kind: "block", bloques: bloquesParalelos, span };
    for (let h = startH + 1; h < startH + span; h++) {
      if (g[b.dia][h] !== undefined) g[b.dia][h] = { kind: "spanned" };
    }
  }

  return g;
}
