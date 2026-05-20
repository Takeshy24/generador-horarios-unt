"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Search, BookOpen, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Curso = {
  id: number;
  codigo: string;
  nombre: string;
  ciclo: number;
  escuela_id: number;
  es_electivo: boolean;
  horas_T: number;
  horas_P: number;
  horas_L: number;
  tipo_lab_requerido: string | null;
};

type Escuela = { id: number; nombre: string };

const NONE = "__none__";

const EMPTY_FORM = {
  codigo: "", nombre: "", ciclo: "1", escuela_id: "",
  es_electivo: "false", horas_T: "0", horas_P: "0", horas_L: "0",
  tipo_lab_requerido: NONE,
};

const LAB_TIPOS = ["lab_computo", "lab_redes", "lab_bd", "lab_ia", "lab_software"];

const LAB_LABELS: Record<string, string> = {
  lab_computo: "Cómputo",
  lab_redes: "Redes",
  lab_bd: "Base de Datos",
  lab_ia: "Inteligencia Artificial",
  lab_software: "Software",
};

export default function CursosPage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [cursos, setCursos] = useState<Curso[]>([]);
  const [escuelas, setEscuelas] = useState<Escuela[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Curso | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCiclo, setFilterCiclo] = useState("todos");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [cursosRes, escuelasRes] = await Promise.all([
        fetch(`${API}/api/admin/cursos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/escuelas`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setCursos(await cursosRes.json());
      setEscuelas(await escuelasRes.json());
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, escuela_id: escuelas[0]?.id.toString() ?? "" });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(c: Curso) {
    setEditTarget(c);
    setForm({
      codigo: c.codigo,
      nombre: c.nombre,
      ciclo: c.ciclo.toString(),
      escuela_id: c.escuela_id.toString(),
      es_electivo: c.es_electivo.toString(),
      horas_T: c.horas_T.toString(),
      horas_P: c.horas_P.toString(),
      horas_L: c.horas_L.toString(),
      tipo_lab_requerido: c.tipo_lab_requerido ?? NONE,
    });
    setFormError(null);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        codigo: form.codigo,
        nombre: form.nombre,
        ciclo: Number(form.ciclo),
        escuela_id: Number(form.escuela_id),
        es_electivo: form.es_electivo === "true",
        horas_T: Number(form.horas_T),
        horas_P: Number(form.horas_P),
        horas_L: Number(form.horas_L),
        tipo_lab_requerido: form.tipo_lab_requerido === NONE ? null : form.tipo_lab_requerido || null,
      };
      const url = editTarget
        ? `${API}/api/admin/cursos/${editTarget.id}`
        : `${API}/api/admin/cursos`;
      const res = await fetch(url, {
        method: editTarget ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Error al guardar");
      }
      setOpen(false);
      load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("¿Eliminar este curso?")) return;
    await fetch(`${API}/api/admin/cursos/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const filtered = cursos.filter((c) => {
    const matchSearch = c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.codigo.toLowerCase().includes(search.toLowerCase());
    const matchCiclo = filterCiclo === "todos" || c.ciclo.toString() === filterCiclo;
    return matchSearch && matchCiclo;
  });

  const totalHoras = (c: Curso) => c.horas_T + c.horas_P + c.horas_L;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-pulse flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-slate-200" />
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cursos</h1>
          <p className="text-base text-gray-500 mt-1">
            {cursos.length} cursos en el plan curricular
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 bg-[#0052cc] hover:bg-[#0040a0]">
          <Plus className="h-4 w-4 mr-2" /> Nuevo curso
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
          />
        </div>
        <Select value={filterCiclo} onValueChange={setFilterCiclo}>
          <SelectTrigger className="w-[180px] border-gray-200">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Filtrar por ciclo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los ciclos</SelectItem>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <SelectItem key={n} value={n.toString()}>{n}° Ciclo</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-gray-150">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Curso</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Código</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Ciclo</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Horas</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Laboratorio</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <BookOpen className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{c.nombre}</p>
                      <div className="text-xs text-gray-500">
                        {c.es_electivo && <Badge variant="outline" className="text-[10px] mr-1">Electivo</Badge>}
                        Escuela
                      </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-600 bg-slate-50 px-2.5 py-1 rounded-lg">{c.codigo}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 text-xs font-bold text-gray-700">
                      {c.ciclo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-semibold">T:{c.horas_T}</span>
                      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold">P:{c.horas_P}</span>
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-semibold">L:{c.horas_L}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {c.tipo_lab_requerido ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                        {LAB_LABELS[c.tipo_lab_requerido] ?? c.tipo_lab_requerido}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(c)} className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <BookOpen className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-gray-500">No se encontraron cursos</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-gray-200">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-gray-150 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {editTarget ? "Editar curso" : "Nuevo curso"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                {editTarget ? "Actualiza la información del curso seleccionado." : "Registra un nuevo curso en el plan curricular."}
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {formError && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Código</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
                  </div>
                  <Input value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="IS-101" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Ciclo</Label>
                <Select value={form.ciclo} onValueChange={(v) => setForm({ ...form, ciclo: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <SelectItem key={n} value={n.toString()}>{n}° Ciclo</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Nombre del curso</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <BookOpen className="h-4 w-4" />
                </div>
                <Input value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                  placeholder="Nombre completo del curso" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Horas Teóricas</Label>
                <Input type="number" min={0} value={form.horas_T}
                  onChange={(e) => setForm({ ...form, horas_T: e.target.value })} className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Horas Prácticas</Label>
                <Input type="number" min={0} value={form.horas_P}
                  onChange={(e) => setForm({ ...form, horas_P: e.target.value })} className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Horas Laboratorio</Label>
                <Input type="number" min={0} value={form.horas_L}
                  onChange={(e) => setForm({ ...form, horas_L: e.target.value })} className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Laboratorio requerido</Label>
                <Select value={form.tipo_lab_requerido}
                  onValueChange={(v) => setForm({ ...form, tipo_lab_requerido: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguno</SelectItem>
                    {LAB_TIPOS.map((t) => (
                      <SelectItem key={t} value={t}>{LAB_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">¿Es electivo?</Label>
                <Select value={form.es_electivo}
                  onValueChange={(v) => setForm({ ...form, es_electivo: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="false">No</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Escuela</Label>
              <Select value={form.escuela_id}
                onValueChange={(v) => setForm({ ...form, escuela_id: v })}>
                <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue placeholder="Seleccionar escuela" /></SelectTrigger>
                <SelectContent>
                  {escuelas.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>{e.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="px-6 py-4 bg-slate-50/50 border-t border-gray-150 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)} className="border-gray-200 hover:bg-gray-100">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0052cc] hover:bg-[#0040a0] text-white shadow-sm">
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}