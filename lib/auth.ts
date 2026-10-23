import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser, getPrimaryWorkspace } from "@/lib/workspace";
import { isEmailAllowedToSignIn } from "@/lib/env";
import { verifyPassword } from "@/lib/password";
import { getRedisConnection } from "@/lib/queue/client";

export const authConfig = {
  providers: [
    Credentials({
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().trim().toLowerCase().email(),
          password: z.string().min(1).max(256),
        }).safeParse(credentials);
        if (!parsed.success || !isEmailAllowedToSignIn(parsed.data.email)) return null;
        const { email, password } = parsed.data;
        const hashes = JSON.parse(process.env.LOGIN_PASSWORD_HASHES ?? "{}");
        if (!Object.hasOwn(hashes, email)) return null;
        const redis = getRedisConnection();
        const key = `auth:password:${createHash("sha256").update(email).digest("hex")}`;
        const attempts = Number(await redis.eval(
          "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 300) end; return n",
          1, key,
        ));
        if (attempts > 10 || !await verifyPassword(password, hashes[email])) return null;
        await redis.del(key);
        const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email } });
        await ensureWorkspaceForUser(user.id, email);
        return user;
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return isEmailAllowedToSignIn(user?.email);
    },
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return isEmailAllowedToSignIn(token.email) ? token : null;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60,
  },
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function getCurrentWorkspaceId(): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const workspace = await getPrimaryWorkspace(userId);
  if (workspace) return workspace.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  const createdWorkspace = await ensureWorkspaceForUser(userId, user?.email);
  return createdWorkspace.id;
}
