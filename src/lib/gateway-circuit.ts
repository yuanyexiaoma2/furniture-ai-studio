import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { circuitFailure, emptyCircuit, type CircuitStore } from "./gateway-router";
import type { GatewayName } from "./gateway-error";

function credentialHash(provider: GatewayName) { return createHash("sha256").update(process.env[provider === "kie" ? "KIE_API_KEY" : "ZENMUX_API_KEY"]?.trim() ?? "").digest("hex"); }
export async function gatewayCircuitState(provider: GatewayName) {
  const state = await db.gatewayCircuit.findUnique({ where: { provider } });
  return state?.credentialHash === credentialHash(provider) ? state : null;
}
export const databaseCircuit: CircuitStore = {
  async isOpen(provider) { const state = await gatewayCircuitState(provider); return Boolean(state?.openUntil && state.openUntil.getTime() > Date.now()); },
  async success(provider) { await change(provider, false); },
  async failure(provider) { await change(provider, true); },
};
async function change(provider: GatewayName, failed: boolean) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`gateway-circuit:${provider}`}, 0))`;
    const old = await tx.gatewayCircuit.findUnique({ where: { provider } });
    const hash = credentialHash(provider), now = Date.now();
    const expired = old?.openUntil && old.openUntil.getTime() <= now;
    const state = old?.credentialHash === hash && !expired ? { consecutiveFailures: old.consecutiveFailures, windowStartedAt: old.windowStartedAt?.getTime() ?? null, openUntil: old.openUntil?.getTime() ?? null } : emptyCircuit();
    const next = failed ? circuitFailure(state, now) : emptyCircuit();
    const data = { credentialHash: hash, consecutiveFailures: next.consecutiveFailures, windowStartedAt: next.windowStartedAt === null ? null : new Date(next.windowStartedAt), openUntil: next.openUntil === null ? null : new Date(next.openUntil) };
    await tx.gatewayCircuit.upsert({ where: { provider }, create: { provider, ...data }, update: data });
  });
}
