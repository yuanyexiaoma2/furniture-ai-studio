import { requireAdmin } from "@/lib/access";
import { gatewayStatus } from "@/lib/gateway-status";
import { GatewayManager } from "@/components/gateway-manager";
export const dynamic = "force-dynamic";
export default async function GatewaysPage() { await requireAdmin(); return <GatewayManager initial={await gatewayStatus()} />; }
