"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Search, Building2, Filter, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Aula = {
  id: number;
  codigo: string;
  tipo: string;
  capacidad: number;
  ubicacion: string | null;
};

const TIPO_LABELS: Record<string, string> = {
  comun: "Aula común",
  lab_computo: "Lab. Cómputo",
  lab_redes: "Lab. Redes",
  lab_bd: "Lab. BD",
  lab_ia: "Lab. IA",
  lab_software: "Lab. Software",
  auditorio: "Auditorio",
};

const TIPO_COLORS: Record<string, string> = {
  comun: "bg-slate-100 text-slate-700",
  lab_computo: "bg-blue-50 text-blue-700",
  lab_redes: "bg-cyan-50 text-cyan-700",
  lab_bd: "bg-purple-50 text-purple-700",
  lab_ia: "bg-orange-50 text-orange-700",
  lab_software: "bg-emerald-50 text-emerald-700",
  auditorio: "bg-amber-50 text-amber-700",
};

const EMPTY_FORM = { codigo: "", tipo: "comun", capacidad: "30", ubicacion: "" };

export default function AulasPage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Aula | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/aulas`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAulas(await res.json());
    } catch {
      setError("Error al cargar aulas");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(a: Aula) {
    setEditTarget(a);
    setForm({
      codigo: a.codigo,
      tipo: a.tipo,
      capacidad: a.capacidad.toString(),
      ubicacion: a.ubicacion ?? "",
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
        tipo: form.tipo,
        capacidad: Number(form.capacidad),
        ubicacion: form.ubicacion || null,
      };
      const url = editTarget
        ? `${API}/api/admin/aulas/${editTarget.id}`
        : `${API}/api/admin/aulas`;
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
    if (!confirm("¿Eliminar esta aula?")) return;
    await fetch(`${API}/api/admin/aulas/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const filtered = aulas.filter((a) => {
    const matchSearch = a.codigo.toLowerCase().includes(search.toLowerCase()) ||
      (a.ubicacion?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchTipo = filterTipo === "todos" || a.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const tipoOrder = ["comun", "lab_computo", "lab_redes", "lab_bd", "lab_ia", "lab_software", "auditorio"];

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Aulas</h1>
          <p className="text-base text-gray-500 mt-1">
            {aulas.length} espacios registrados en el sistema
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 bg-[#0052cc] hover:bg-[#0040a0]">
          <Plus className="h-4 w-4 mr-2" /> Nueva aula
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
            placeholder="Buscar por código o ubicación..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[200px] border-gray-200">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            {tipoOrder.map((t) => (
              <SelectItem key={t} value={t}>{TIPO_LABELS[t]}</SelectItem>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Aula</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Capacidad</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 font-mono">{a.codigo}</p>
                        <p className="text-xs text-gray-500">{a.ubicacion ?? "Sin ubicación"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TIPO_COLORS[a.tipo] ?? "bg-slate-100 text-slate-700"}`}>
                      {TIPO_LABELS[a.tipo]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center h-8 w-12 rounded-lg bg-blue-50 text-blue-700 text-sm font-bold">
                      {a.capacidad}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">alumnos</span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{a.ubicacion ?? "—"}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(a)} className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-gray-500">No se encontraron aulas</p>
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
        <DialogContent className="max-w-lg p-0 overflow-hidden border-gray-200">
          <div className="bg-slate-50/50 px-6 py-4 border-b border-gray-150 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {editTarget ? "Editar aula" : "Nueva aula"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                {editTarget ? "Actualiza la información del aula seleccionada." : "Registra un nuevo espacio físico en el sistema."}
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
                    placeholder="A-101" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Capacidad</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <Users className="h-4 w-4" />
                  </div>
                  <Input type="number" min={1} value={form.capacidad}
                    onChange={(e) => setForm({ ...form, capacidad: e.target.value })} className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Tipo de aula</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Ubicación (opcional)</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <Input value={form.ubicacion}
                  onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
                  placeholder="Pabellón A, 1er piso" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
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