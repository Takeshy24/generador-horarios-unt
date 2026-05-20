import { auth } from "@/auth";
import { NextResponse } from "next/server";

const ROLE_HOME: Record<string, string> = {
  admin: "/admin",
  director_escuela: "/director-escuela",
  director_depto: "/director-depto",
  docente: "/docente",
};

const PROTECTED_PREFIXES = ["/admin", "/director-escuela", "/director-depto", "/docente"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Sin sesión → login
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user.role as string;
  const userHome = ROLE_HOME[role] ?? "/login";

  // Acceso a ruta de otro rol → redirigir a su propio dashboard
  const isWrongArea = PROTECTED_PREFIXES.some(
    (p) => pathname.startsWith(p) && p !== userHome && !userHome.startsWith(p)
  );
  if (isWrongArea) {
    return NextResponse.redirect(new URL(userHome, req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/director-escuela/:path*",
    "/director-depto/:path*",
    "/docente/:path*",
  ],
};
