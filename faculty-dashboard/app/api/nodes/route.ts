import { NextResponse } from "next/server";
import http from "http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface DiscoveredNode {
  id: string;
  hostname: string;
  role: "manager" | "worker";
  ip: string;
  status: "ready" | "down" | "unknown";
  dbContainerName?: string;
  dbIp?: string;
  dbStatus?: "online" | "offline" | "unknown";
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
    // 1. Query Swarm Nodes & Tasks
    const swarmNodes = await queryDockerSocket("/v1.43/nodes");
    const tasks = await queryDockerSocket("/v1.43/tasks");

    if (Array.isArray(swarmNodes)) {
      for (const n of swarmNodes) {
        const hostname = n.Description?.Hostname || n.ID?.substring(0, 12) || "node";
        const role = n.Spec?.Role || "worker";
        const ip = n.Status?.Addr || "127.0.0.1";
        const state = n.Status?.State || "unknown";

        let dbIp = undefined;
        let dbStatus: "online" | "offline" | "unknown" = "offline";
        let dbContainerName = undefined;

        if (Array.isArray(tasks)) {
          const nodeTasks = tasks.filter((t) => t.NodeID === n.ID && t.Status?.State === "running");
          for (const task of nodeTasks) {
            if (task.NetworksAttachments) {
              const attach = task.NetworksAttachments.find((na: any) =>
                na.Network && na.Network.Spec && na.Network.Spec.Name === "oracle_cluster_net"
              );
              
              if (attach && attach.Addresses && attach.Addresses.length > 0) {
                dbIp = attach.Addresses[0].split("/")[0];
                dbStatus = "online";
                dbContainerName = "oracle-db";
                break;
              }
            }
          }
        }

        nodes.push({
          id: n.ID,
          hostname,
          role,
          ip,
          status: state === "ready" ? "ready" : "down",
          dbIp,
          dbStatus,
          dbContainerName
        });
      }
    }
  } catch (err) {
    // socket query fallback
  }

  if (nodes.length === 0) {
    nodes.push({
      id: "local",
      hostname: "LOCAL_HOST",
      role: "manager",
      ip: "127.0.0.1",
      status: "ready",
      dbIp: "127.0.0.1",
      dbStatus: "online",
      dbContainerName: "local-oracle"
    });
  }

  return NextResponse.json({ success: true, nodes });
}
