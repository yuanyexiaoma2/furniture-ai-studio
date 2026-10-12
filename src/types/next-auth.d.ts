import type { DefaultSession } from "next-auth";
import type { Role } from "@/generated/prisma/enums";

declare module "next-auth" {
  interface Session { user: DefaultSession["user"] & { id: string; role: Role } }
  interface User { role: Role; authVersion: number }
}

declare module "next-auth/jwt" {
  interface JWT { role: Role; authVersion: number }
}
