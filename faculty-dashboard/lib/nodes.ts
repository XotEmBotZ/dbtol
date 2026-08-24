import type { DiscoveredNode } from "./types";

export async function fetchNodes(): Promise<DiscoveredNode[]> {
  const res = await fetch("/api/nodes");
  const data = await res.json();
  if (data.success && Array.isArray(data.nodes)) {
    return data.nodes as DiscoveredNode[];
  }
  return [];
}
