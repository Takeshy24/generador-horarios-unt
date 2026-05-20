import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    docente_id: number | null;
    access_token: string;
  }

  interface Session {
    user: {
      role: string;
      docente_id: number | null;
      access_token: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    docente_id: number | null;
    access_token: string;
  }
}
