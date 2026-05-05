import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/password";

export const sessionMaxAgeSeconds = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: sessionMaxAgeSeconds },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? Role.MEMBER;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
};

export function isSecureCookie(): boolean {
  const url = process.env.NEXTAUTH_URL ?? "";
  return url.startsWith("https://");
}

export function getSessionCookieName(): string {
  return isSecureCookie() ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

// RBAC usage in Route Handlers:
// const guard = await requireAdmin();
// if (guard instanceof Response) return guard;
