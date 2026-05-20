import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();

          return {
            id: String(data.user_id),
            email: data.email,
            name: data.nombre,
            role: data.role,
            docente_id: data.docente_id ?? null,
            access_token: data.access_token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

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
});
