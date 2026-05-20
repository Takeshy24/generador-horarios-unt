"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, Trash2, Search, ShieldCheck, Users, Filter } from "lucide-react";
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

type Usuario = {
  id: number;
  email: string;
  role: string;
  docente_id: number | null;
  docente_nombre: string | null;
  created_at: string;
};

type DocenteOption = { id: number; nombre_completo: string };

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  director_escuela: "Director de Escuela",
  director_depto: "Director de Depto.",
  docente: "Docente",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-50 text-red-700",
  director_escuela: "bg-blue-50 text-blue-700",
  director_depto: "bg-purple-50 text-purple-700",
  docente: "bg-emerald-50 text-emerald-700",
};

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <ShieldCheck className="h-4 w-4 text-red-500" />,
  director_escuela: <Users className="h-4 w-4 text-blue-500" />,
  director_depto: <Users className="h-4 w-4 text-purple-500" />,
  docente: <Users className="h-4 w-4 text-emerald-500" />,
};

const NONE = "__none__";

const EMPTY_FORM = { email: "", password: "", role: "docente", docente_id: NONE };

export default function UsuariosPage() {
  const { data: session } = useSession();
  const token = session?.user.access_token;

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [docentes, setDocentes] = useState<DocenteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Usuario | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("todos");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, docentesRes] = await Promise.all([
        fetch(`${API}/api/admin/usuarios`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/admin/docentes`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setUsuarios(await usersRes.json());
      setDocentes(await docentesRes.json());
    } catch {
      setError("Error al cargar datos");
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

  function openEdit(u: Usuario) {
    setEditTarget(u);
    setForm({
      email: u.email,
      password: "",
      role: u.role,
      docente_id: u.docente_id?.toString() ?? NONE,
    });
    setFormError(null);
    setOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        role: form.role,
        docente_id: (form.docente_id && form.docente_id !== NONE) ? Number(form.docente_id) : null,
      };
      if (!editTarget) {
        if (!form.password) throw new Error("La contraseña es requerida");
        body.password = form.password;
      } else if (form.password) {
        body.password = form.password;
      }

      const url = editTarget
        ? `${API}/api/admin/usuarios/${editTarget.id}`
        : `${API}/api/admin/usuarios`;
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
    if (!confirm("¿Eliminar este usuario?")) return;
    const res = await fetch(`${API}/api/admin/usuarios/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      alert(err.detail ?? "No se pudo eliminar");
      return;
    }
    load();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
  }

  const getInitials = (email: string) => {
    const parts = email.split("@")[0].split(/[._]/);
    return parts.map((p) => p[0].toUpperCase()).join("").substring(0, 2);
  };

  const filtered = usuarios.filter((u) => {
    const matchSearch = u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.docente_nombre?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchRole = filterRole === "todos" || u.role === filterRole;
    return matchSearch && matchRole;
  });

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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Usuarios del Sistema</h1>
          <p className="text-base text-gray-500 mt-1">
            {usuarios.length} cuentas registradas con acceso al sistema
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0 bg-[#0052cc] hover:bg-[#0040a0]">
          <Plus className="h-4 w-4 mr-2" /> Nuevo usuario
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
            placeholder="Buscar por email o docente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[200px] border-gray-200">
            <Filter className="h-4 w-4 mr-2 text-gray-400" />
            <SelectValue placeholder="Filtrar por rol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
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
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Docente vinculado</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Creado</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-sm shrink-0">
                        {getInitials(u.email)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{u.email}</p>
                        <p className="text-xs text-gray-500">ID: {u.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {ROLE_ICONS[u.role]}
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role]}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.docente_nombre ? (
                      <span className="text-gray-700 text-sm">{u.docente_nombre}</span>
                    ) : (
                      <span className="text-gray-400 text-xs italic">Sin vinculación</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)} className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(u.id)} className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600">
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
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm text-gray-500">No se encontraron usuarios</p>
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
            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-gray-900">
                {editTarget ? "Editar usuario" : "Nuevo usuario"}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-0.5">
                {editTarget ? "Actualiza los datos de acceso del usuario." : "Crea una nueva cuenta de acceso al sistema."}
              </DialogDescription>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {formError && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-700">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Correo electrónico</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
                <Input type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@unt.edu.pe" className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">
                {editTarget ? "Nueva contraseña (opcional)" : "Contraseña"}
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <Input type="password" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editTarget ? "••••••••" : "Mínimo 6 caracteres"} className="pl-10 border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-gray-700">Rol de acceso</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, docente_id: NONE })}>
                <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.role === "docente" && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-700">Docente vinculado</Label>
                <Select value={form.docente_id}
                  onValueChange={(v) => setForm({ ...form, docente_id: v })}>
                  <SelectTrigger className="border-gray-200 focus:border-[#0052cc] focus:ring-[#0052cc]/20"><SelectValue placeholder="Seleccionar docente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Ninguno</SelectItem>
                    {docentes.map((d) => (
                      <SelectItem key={d.id} value={d.id.toString()}>{d.nombre_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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