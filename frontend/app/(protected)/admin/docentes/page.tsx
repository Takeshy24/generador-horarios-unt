"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Search, Users, Filter } from "lucide-react";
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

type Docente = {
  id: number;
  dni: string;
  nombre_completo: string;
  tipo: string;
  fecha_ingreso: string;
  regimen: string;
  categoria: string | null;
  departamento_id: number;
  departamento_nombre: string;
};

type Departamento = { id: number; nombre: string };

const REGIMEN_LABELS: Record<string, string> = {
  DE: "D.E.", TC: "T.C.", TP1: "T.P. 1", TP2: "T.P. 2", TP3: "T.P. 3",
  CONTRATO_A1: "Cont. A1", CONTRATO_A2: "Cont. A2", CONTRATO_A3: "Cont. A3",
  CONTRATO_B1: "Cont. B1", CONTRATO_B2: "Cont. B2", CONTRATO_B3: "Cont. B3",
};

const REGIMEN_COLORS: Record<string, string> = {
  DE: "bg-blue-50 text-blue-700",
  TC: "bg-emerald-50 text-emerald-700",
  TP1: "bg-amber-50 text-amber-700",
  TP2: "bg-amber-50 text-amber-700",
  TP3: "bg-amber-50 text-amber-700",
  CONTRATO_A1: "bg-purple-50 text-purple-700",
  CONTRATO_A2: "bg-purple-50 text-purple-700",
  CONTRATO_A3: "bg-purple-50 text-purple-700",
  CONTRATO_B1: "bg-slate-100 text-slate-700",
  CONTRATO_B2: "bg-slate-100 text-slate-700",
  CONTRATO_B3: "bg-slate-100 text-slate-700",
};

const NONE = "__none__";

const EMPTY_FORM = {
  dni: "", nombre_completo: "", tipo: "nombrado", fecha_ingreso: "",
  regimen: "TC", categoria: NONE, departamento_id: "",
};

export default function DocentesPage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [deptos, setDeptos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Docente | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("todos");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [docentesRes, deptosRes] = await Promise.all([
        fetch(`${API}/api/admin/docentes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/departamentos`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setDocentes(await docentesRes.json());
      setDeptos(await deptosRes.json());
    } catch {
      setError("Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, departamento_id: deptos[0]?.id.toString() ?? "" });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(d: Docente) {
    setEditTarget(d);
    setForm({
      dni: d.dni,
      nombre_completo: d.nombre_completo,
      tipo: d.tipo,
      fecha_ingreso: d.fecha_ingreso,
      regimen: d.regimen,
      categoria: d.categoria ?? NONE,
      departamento_id: d.departamento_id.toString(),
    });
    setFormError(null);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const body = {
        ...form,
        departamento_id: Number(form.departamento_id),
        categoria: form.categoria === NONE ? null : form.categoria || null,
      };
      const url = editTarget
        ? `${API}/api/admin/docentes/${editTarget.id}`
        : `${API}/api/admin/docentes`;
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
    if (!confirm("¿Eliminar este docente?")) return;
    await fetch(`${API}/api/admin/docentes/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  }

  const filtered = docentes.filter((d) => {
    const matchSearch = d.nombre_completo.toLowerCase().includes(search.toLowerCase()) ||
      d.dni.includes(search);
    const matchTipo = filterTipo === "todos" || d.tipo === filterTipo;
    return matchSearch && matchTipo;
  });

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Docentes</h1>
          <p className="text-base text-gray-500 mt-1">
            {docentes.length} docentes registrados en el sistema
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 bg-[#0052cc] hover:bg-[#0040a0]">
          <Plus className="h-4 w-4 mr-2" /> Nuevo docente
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
            placeholder="Buscar por nombre o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
          />
        </div>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[180px] border-gray-200">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los tipos</SelectItem>
            <SelectItem value="nombrado">Nombrados</SelectItem>
            <SelectItem value="contratado">Contratados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-gray-150">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Docente</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">DNI</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Régimen</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Departamento</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm shrink-0">
                        {getInitials(d.nombre_completo)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{d.nombre_completo}</p>
                        <p className="text-xs text-gray-500">Ingreso: {d.fecha_ingreso || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-gray-600 bg-slate-50 px-2 py-1 rounded">{d.dni}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={d.tipo === "nombrado" ? "default" : "secondary"} className="text-xs">
                      {d.tipo === "nombrado" ? "Nombrado" : "Contratado"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${REGIMEN_COLORS[d.regimen] ?? "bg-slate-100 text-slate-700"}`}>
                      {REGIMEN_LABELS[d.regimen] ?? d.regimen}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600 capitalize">{d.categoria ?? "—"}</td>
                  <td className="px-6 py-4 text-gray-600">{d.departamento_nombre}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-gray-500">No se encontraron docentes</p>
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
              <Users className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {editTarget ? "Editar docente" : "Nuevo docente"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                {editTarget ? "Actualiza la información del docente seleccionado." : "Registra un nuevo docente en el sistema institucional."}
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
                <Label className="text-sm font-semibold text-gray-700">DNI</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h3v2H7z"/><path d="M7 13h10v2H7z"/><path d="M7 17h10v2H7z"/></svg>
                  </div>
                  <Input value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })}
                    placeholder="12345678" maxLength={8} className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Fecha de ingreso</Label>
                <Input type="date" value={form.fecha_ingreso}
                  onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })} className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Nombre completo</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <Input value={form.nombre_completo}
                  onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })}
                  placeholder="Apellidos y nombres" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nombrado">Nombrado</SelectItem>
                    <SelectItem value="contratado">Contratado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Categoría</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue placeholder="Ninguna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguna</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="asociado">Asociado</SelectItem>
                    <SelectItem value="auxiliar">Auxiliar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Régimen</Label>
                <Select value={form.regimen} onValueChange={(v) => setForm({ ...form, regimen: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(REGIMEN_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Departamento</Label>
                <Select value={form.departamento_id}
                  onValueChange={(v) => setForm({ ...form, departamento_id: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {deptos.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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