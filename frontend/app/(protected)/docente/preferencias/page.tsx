"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Save, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DIAS_OPTIONS = [
  { value: "LUN", label: "Lunes" },
  { value: "MAR", label: "Martes" },
  { value: "MIE", label: "Miércoles" },
  { value: "JUE", label: "Jueves" },
  { value: "VIE", label: "Viernes" },
  { value: "SAB", label: "Sábado" },
];

type Preferencias = {
  turno_preferido: string;
  max_horas_seguidas: number;
  dias_evitar: string[];
};

export default function PreferenciasPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<Preferencias>({
    turno_preferido: "indiferente",
    max_horas_seguidas: 4,
    dias_evitar: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  useEffect(() => {
    if (!session?.user.access_token) return;
    fetch(`${API}/api/docentes/me/preferencias`, {
      headers: { Authorization: `Bearer ${session.user.access_token}` },
    })
      .then(r => r.json())
      .then(data => setPrefs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.user.access_token]);

  function toggleDia(dia: string) {
    setPrefs(prev => ({
      ...prev,
      dias_evitar: prev.dias_evitar.includes(dia)
        ? prev.dias_evitar.filter(d => d !== dia)
        : [...prev.dias_evitar, dia],
    }));
  }

  async function guardar() {
    if (!session?.user.access_token) return;
    setSaving(true);
    setMensaje(null);
    try {
      const res = await fetch(`${API}/api/docentes/me/preferencias`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.user.access_token}`,
        },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error();
      setMensaje({ tipo: "ok", texto: "Preferencias guardadas correctamente." });
    } catch {
      setMensaje({ tipo: "error", texto: "Error al guardar. Intenta de nuevo." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground animate-pulse">Cargando preferencias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-headline-lg text-foreground">Mis Preferencias</h1>
        <p className="text-muted-foreground text-sm">
          El motor de generación de horarios las considerará como restricciones blandas.
        </p>
      </div>

      {mensaje && (
        <Alert variant={mensaje.tipo === "ok" ? "success" : "destructive"}>
          <AlertDescription>{mensaje.texto}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-yellow-500" />
            Configuración de preferencias
          </CardTitle>
          <CardDescription>
            Estas preferencias no son vinculantes — el motor puede ignorarlas si es necesario para evitar conflictos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Turno preferido */}
          <div className="space-y-2">
            <Label htmlFor="turno">Turno preferido</Label>
            <Select
              value={prefs.turno_preferido}
              onValueChange={v => setPrefs(p => ({ ...p, turno_preferido: v }))}
            >
              <SelectTrigger id="turno" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mañana">Mañana (7:00 – 13:00)</SelectItem>
                <SelectItem value="tarde">Tarde (14:00 – 20:00)</SelectItem>
                <SelectItem value="indiferente">Indiferente</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              El motor intentará colocar tus clases en este turno cuando sea posible.
            </p>
          </div>

          {/* Máximo horas seguidas */}
          <div className="space-y-2">
            <Label htmlFor="max-horas">Máximo de horas seguidas</Label>
            <div className="flex items-center gap-3">
              <input
                id="max-horas"
                type="number"
                min={1}
                max={8}
                value={prefs.max_horas_seguidas}
                onChange={e => setPrefs(p => ({
                  ...p,
                  max_horas_seguidas: Math.min(8, Math.max(1, parseInt(e.target.value) || 1)),
                }))}
                className="w-20 h-9 rounded-md border border-input bg-background px-3 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground">horas consecutivas</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Se preferirá no colocar más de {prefs.max_horas_seguidas}h de clase sin descanso.
            </p>
          </div>

          {/* Días a evitar */}
          <div className="space-y-3">
            <Label>Días que prefiero evitar</Label>
            <div className="flex flex-wrap gap-2">
              {DIAS_OPTIONS.map(({ value, label }) => {
                const activo = prefs.dias_evitar.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleDia(value)}
                    className={[
                      "px-4 py-2 rounded-md border text-sm font-medium transition-colors",
                      activo
                        ? "bg-red-100 border-red-300 text-red-700"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {prefs.dias_evitar.length === 0
                ? "No has seleccionado días a evitar."
                : `Evitarás: ${prefs.dias_evitar.map(d => DIAS_OPTIONS.find(o => o.value === d)?.label).join(", ")}`
              }
            </p>
          </div>

          {/* Guardar */}
          <div className="pt-2">
            <Button onClick={guardar} disabled={saving} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Guardando..." : "Guardar preferencias"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
