"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  GraduationCap, Loader2, Mail, Lock, Eye, EyeOff,
  ArrowRight, BookOpen, Headphones, Book,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  director_escuela: "/director-escuela",
  director_depto: "/director-depto",
  docente: "/docente",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error || !result?.ok) {
        setError("Credenciales incorrectas. Verifica tu email y contraseña.");
        return;
      }

      const res = await fetch("/api/auth/session");
      const session = await res.json();
      const role = session?.user?.role as string | undefined;
      const dest = role ? (ROLE_HOME[role] ?? "/login") : "/login";
      router.push(dest);
    } catch {
      setError("Error de conexión. Verifica que el servidor esté activo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/screen.png')" }}>
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

      <div className="w-full max-w-md space-y-8 animate-fade-in relative z-10">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="bg-[#0052cc] text-white rounded-xl p-3 shadow-lg shadow-blue-900/20">
              <GraduationCap className="h-8 w-8" />
            </div>
          </div>
          <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Generador de Horarios UNT
          </h1>
          <p className="text-sm text-slate-300 mt-1">
            Universidad Nacional de Trujillo — Ing. de Sistemas
          </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Correo Electrónico
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@unt.edu.pe"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pl-10 border-gray-300 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Contraseña
                </Label>
                <button
                  type="button"
                  className="text-xs text-[#0052cc] hover:text-[#0040a0] font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-11 pl-10 pr-10 border-gray-300 focus:border-[#0052cc] focus:ring-[#0052cc]/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                className="h-4 w-4 rounded border-gray-300 text-[#0052cc] focus:ring-[#0052cc]/20"
              />
              <Label htmlFor="remember" className="text-sm text-gray-600 cursor-pointer">
                Mantener sesión iniciada
              </Label>
            </div>

            {/* Error */}
            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 bg-[#0052cc] hover:bg-[#0040a0] text-white font-medium rounded-lg shadow-sm"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Contact */}
          <div className="text-center">
            <p className="text-sm text-gray-600">
              ¿No tienes acceso?{" "}
              <button className="text-[#0052cc] hover:text-[#0040a0] font-medium">
                Contactar a Secretaría
              </button>
            </p>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-2">
            <BookOpen className="h-5 w-5 text-[#0052cc]" />
            <h3 className="text-sm font-semibold text-gray-900">Manual de Usuario</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Aprende a generar horarios eficientes siguiendo nuestra guía institucional.
            </p>
          </div>
          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-4 space-y-2">
            <Headphones className="h-5 w-5 text-[#0052cc]" />
            <h3 className="text-sm font-semibold text-gray-900">Soporte Técnico</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              ¿Problemas con el sistema? Nuestro equipo de IT está listo para ayudarte.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center space-y-1">
          <p className="text-xs text-gray-500">
            © 2024 Universidad Nacional de Trujillo.
          </p>
          <p className="text-xs text-gray-500">
            Facultad de Ingeniería — Departamento de Ingeniería de Sistemas.
          </p>
        </div>
      </div>

      {/* Version Badge */}
      <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-green-500" />
        <span className="text-xs text-gray-600 font-medium">Sistema Operativo - v2.4.0</span>
      </div>
    </main>
  );
}