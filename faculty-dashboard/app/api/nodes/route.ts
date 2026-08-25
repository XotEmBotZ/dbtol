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
    // 1. Query Swarm Nodes, Tasks, and oracle_cluster_net network
    const [swarmNodes, tasks, clusterNet] = await Promise.all([
      queryDockerSocket("/v1.43/nodes"),
      queryDockerSocket("/v1.43/tasks"),
      queryDockerSocket("/v1.43/networks/oracle_cluster_net"),
    ]);

    // Extract all DB containers attached to oracle_cluster_net
    const dbContainers: { id: string; name: string; ip: string }[] = [];
    if (clusterNet && clusterNet.Containers && typeof clusterNet.Containers === "object") {
      for (const [cId, cData] of Object.entries<any>(clusterNet.Containers)) {
        const rawName = cData.Name || "";
        const cleanName = rawName.replace(/^\//, "");
        
        // Filter out dashboard, load balancer, and internal endpoints
        if (
          cleanName.toLowerCase().includes("dashboard") ||
          cleanName.toLowerCase().includes("endpoint") ||
          cleanName.startsWith("lb-") ||
          cId.startsWith("lb-")
        ) {
          continue;
        }

        const ip = cData.IPv4Address ? cData.IPv4Address.split("/")[0] : undefined;
        if (ip) {
          dbContainers.push({
            id: cId,
            name: cleanName || "oracle-db",
            ip,
          });
        }
      }
    }

    const assignedContainerIds = new Set<string>();

    // 2. Process Swarm nodes if present
    if (Array.isArray(swarmNodes) && swarmNodes.length > 0) {
      for (const n of swarmNodes) {
        const hostname = n.Description?.Hostname || n.ID?.substring(0, 12) || "node";
        const role = n.Spec?.Role || "worker";
        const ip = n.Status?.Addr || "127.0.0.1";
        const state = n.Status?.State || "unknown";

        let dbIp: string | undefined = undefined;
        let dbStatus: "online" | "offline" | "unknown" = "offline";
        let dbContainerName: string | undefined = undefined;

        // Check Swarm tasks first
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

        // If no swarm task DB found, match unassigned compose container from oracle_cluster_net
        if (!dbIp && dbContainers.length > 0) {
          const unassigned = dbContainers.find((c) => !assignedContainerIds.has(c.id));
          if (unassigned) {
            dbIp = unassigned.ip;
            dbStatus = "online";
            dbContainerName = unassigned.name;
            assignedContainerIds.add(unassigned.id);
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
          dbContainerName,
        });
      }
    }

    // 3. Add any remaining compose DB containers on oracle_cluster_net as standalone discovered nodes
    for (const c of dbContainers) {
      if (!assignedContainerIds.has(c.id)) {
        nodes.push({
          id: c.id.substring(0, 12),
          hostname: c.name.toUpperCase(),
          role: "worker",
          ip: c.ip,
          status: "ready",
          dbIp: c.ip,
          dbStatus: "online",
          dbContainerName: c.name,
        });
        assignedContainerIds.add(c.id);
      }
    }
  } catch (err) {
    // socket query fallback
  }

  // 4. Default fallback if nothing discovered
  if (nodes.length === 0) {
    nodes.push({
      id: "local",
      hostname: "LOCAL_HOST",
      role: "manager",
      ip: "127.0.0.1",
      status: "ready",
      dbIp: "127.0.0.1",
      dbStatus: "online",
      dbContainerName: "local-oracle",
    });
  }

  return NextResponse.json({ success: true, nodes });
}
