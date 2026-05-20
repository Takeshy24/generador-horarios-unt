import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  providers: [], // Vacío aquí para compatibilidad con Edge Runtime
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.docente_id = user.docente_id;
        token.access_token = user.access_token;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as string;
      session.user.docente_id = token.docente_id as number | null;
      session.user.access_token = token.access_token as string;
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
} satisfies NextAuthConfig;
