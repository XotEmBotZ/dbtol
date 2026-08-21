import { NextResponse } from "next/server";
import http from "http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface DiscoveredNode {
  id: string;
  hostname: string;
  role: "manager" | "worker";
  ip: string;
  status: "ready" | "down" | "unknown";
}

function queryDockerSocket(path: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      socketPath: "/var/run/docker.sock",
      path: path,
      method: "GET",
      headers: { Host: "localhost" },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on("error", (err) => {
      resolve(null);
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

export async function GET() {
  const nodes: DiscoveredNode[] = [];

  try {
    // 1. Query Swarm Nodes
    const swarmNodes = await queryDockerSocket("/v1.43/nodes");

    if (Array.isArray(swarmNodes)) {
      for (const n of swarmNodes) {
        const hostname = n.Description?.Hostname || n.ID?.substring(0, 12) || "node";
        const role = n.Spec?.Role || "worker";
        const ip = n.Status?.Addr || "127.0.0.1";
        const state = n.Status?.State || "unknown";

        nodes.push({
          id: n.ID,
          hostname,
          role,
          ip,
          status: state === "ready" ? "ready" : "down",
        });
      }
    }

    // 2. Query Containers attached to overlay network if available
    const networkInfo = await queryDockerSocket("/v1.43/networks/oracle_cluster_net");
    if (networkInfo?.Containers) {
      for (const [cId, container] of Object.entries<any>(networkInfo.Containers)) {
        const cIp = container.IPv4Address ? container.IPv4Address.split("/")[0] : "";
        const cName = container.Name || cId.substring(0, 12);
        
        // If not already in nodes list
        if (cIp && !nodes.some((n) => n.ip === cIp)) {
          nodes.push({
            id: cId,
            hostname: cName,
            role: "worker",
            ip: cIp,
            status: "ready",
          });
        }
      }
    }
  } catch (err) {
    // socket query fallback
  }

  // If no nodes discovered from socket (e.g. standalone test mode), provide standard localhost preset
  if (nodes.length === 0) {
    nodes.push({
      id: "local",
      hostname: "LOCAL_HOST",
      role: "manager",
      ip: "127.0.0.1",
      status: "ready",
    });
  }

  return NextResponse.json({ success: true, nodes });
}
