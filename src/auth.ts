import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { loginSchema, roleSchema } from "@/lib/validation";

// 不存在的账号也验证一次哈希，避免通过响应时间枚举邮箱。
let dummyHash: Promise<string> | undefined;

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [Credentials({
    credentials: { email: {}, password: {} },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;
      const user = await db.user.findUnique({ where: { email: parsed.data.email } });
      dummyHash ??= bcrypt.hash(randomBytes(32).toString("hex"), 12);
      const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? await dummyHash);
      if (!user || !valid) return null;
      return { id: user.id, name: user.name, email: user.email, role: user.role, authVersion: user.authVersion };
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) { token.sub = user.id; token.authVersion = user.authVersion; }
      if (!token.sub) return null;
      const current = await db.user.findUnique({
        where: { id: token.sub },
        select: { name: true, email: true, role: true, authVersion: true },
      });
      // 重置密码、修改角色后，已有会话即时失效。
      if (!current || current.authVersion !== token.authVersion) return null;
      token.name = current.name;
      token.email = current.email;
      token.role = current.role;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.role = roleSchema.parse(token.role);
      return session;
    },
  },
});
