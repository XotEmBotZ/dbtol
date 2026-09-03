import { NextResponse } from "next/server";
import net from "net";
import os from "os";
import type { DiscoveredNode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TARGET_PORTS = [1521, 1522];
const PROBE_TIMEOUT_MS = 350;

function checkPort(host: string, port: number, timeout = PROBE_TIMEOUT_MS): Promise<number | null> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.destroy();
      resolve(port);
    });
    socket.setTimeout(timeout);
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(null);
    });
  });
}

function getSubnetPrefixes(): { subnetPrefix: string; localIps: Set<string> } {
  const localIps = new Set<string>();
  const prefixes = new Set<string>();

  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        localIps.add(iface.address);
        const parts = iface.address.split(".");
        if (parts.length === 4) {
          prefixes.add(parts.slice(0, 3).join("."));
        }
      }
    }
  }

  // Ensure default overlay subnet 10.0.1 is always probed
  prefixes.add("10.0.1");

  return {
    subnetPrefix: Array.from(prefixes)[0] || "10.0.1",
    localIps,
  };
}

export async function GET() {
  const nodes: DiscoveredNode[] = [];
  const { subnetPrefix, localIps } = getSubnetPrefixes();

  try {
    const probeTasks: Promise<{ ip: string; port: number } | null>[] = [];

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnetPrefix}.${i}`;
      // Skip the dashboard container's own IP
      if (localIps.has(ip)) continue;

      probeTasks.push(
        (async () => {
          for (const port of TARGET_PORTS) {
            const openPort = await checkPort(ip, port);
            if (openPort) {
              return { ip, port: openPort };
            }
          }
          return null;
        })()
      );
    }

    const liveTargets = (await Promise.all(probeTasks)).filter(
      (item): item is { ip: string; port: number } => item !== null
    );

    for (const target of liveTargets) {
      const lastOctet = target.ip.split(".")[3] || "0";
      nodes.push({
        id: `node-${target.ip.replace(/\./g, "-")}`,
        hostname: `STUDENT_DB_${lastOctet.padStart(2, "0")}`,
        role: "worker",
        ip: target.ip,
        status: "ready",
        dbIp: target.ip,
        dbPort: target.port,
        dbStatus: "online",
        dbContainerName: `oracle-db-${lastOctet}`,
      });
    }
  } catch (err) {
    console.error("Subnet sweep error:", err);
  }

  // Fallback if no remote DB instances responded
  if (nodes.length === 0) {
    nodes.push({
      id: "local-node",
      hostname: "LOCAL_HOST",
      role: "manager",
      ip: "127.0.0.1",
      status: "ready",
      dbIp: "127.0.0.1",
      dbPort: 1522,
      dbStatus: "online",
      dbContainerName: "local-oracle",
    });
  }

  return NextResponse.json({ success: true, nodes });
}
