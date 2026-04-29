import Dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";

const FALLBACK = {
  dataset: { width: 200, height: 100 },
  train: { width: 200, height: 110 },
  evaluate: { width: 200, height: 100 },
  document: { width: 230, height: 170 },
  vector_store: { width: 210, height: 130 },
  rag_config: { width: 280, height: 270 },
} satisfies Record<string, { width: number; height: number }>;

const DEFAULT_DIMS = { width: 200, height: 110 };

function dimsFor(node: Node): { width: number; height: number } {
  const measured = (node as Node & { measured?: { width?: number; height?: number } }).measured;
  if (measured?.width && measured?.height) {
    return { width: measured.width, height: measured.height };
  }
  return FALLBACK[node.type as keyof typeof FALLBACK] ?? DEFAULT_DIMS;
}

export interface AutoLayoutOptions {
  direction?: "LR" | "TB";
  rankSpacing?: number;
  nodeSpacing?: number;
}

/**
 * Arrange nodes in a clean DAG using dagre. Disconnected sub-graphs are
 * laid out independently and stacked vertically so they never overlap.
 */
export function autoLayoutNodes(
  nodes: Node[],
  edges: Edge[],
  opts: AutoLayoutOptions = {},
): Node[] {
  if (nodes.length === 0) return nodes;

  const direction = opts.direction ?? "LR";
  const rankSpacing = opts.rankSpacing ?? 80;
  const nodeSpacing = opts.nodeSpacing ?? 50;

  const components = splitByConnectedComponents(nodes, edges);
  const verticalGap = 80;
  let cursorY = 0;
  const positioned: Node[] = [];

  for (const component of components) {
    const componentNodes = component.nodes;
    const componentEdges = edges.filter(
      (e) =>
        componentNodes.some((n) => n.id === e.source) &&
        componentNodes.some((n) => n.id === e.target),
    );

    const g = new Dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: direction, ranksep: rankSpacing, nodesep: nodeSpacing });

    for (const n of componentNodes) {
      const { width, height } = dimsFor(n);
      g.setNode(n.id, { width, height });
    }
    for (const e of componentEdges) {
      g.setEdge(e.source, e.target);
    }

    Dagre.layout(g);

    let minX = Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const positions = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const n of componentNodes) {
      const { x, y } = g.node(n.id);
      const { width, height } = dimsFor(n);
      const nx = x - width / 2;
      const ny = y - height / 2;
      positions.set(n.id, { x: nx, y: ny, width, height });
      if (nx < minX) minX = nx;
      if (ny < minY) minY = ny;
      if (ny + height > maxY) maxY = ny + height;
    }

    for (const n of componentNodes) {
      const p = positions.get(n.id)!;
      positioned.push({
        ...n,
        position: { x: p.x - minX, y: p.y - minY + cursorY },
      });
    }
    cursorY += maxY - minY + verticalGap;
  }

  return positioned;
}

interface ConnectedComponent {
  nodes: Node[];
}

function splitByConnectedComponents(nodes: Node[], edges: Edge[]): ConnectedComponent[] {
  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n.id, new Set());
  for (const e of edges) {
    adjacency.get(e.source)?.add(e.target);
    adjacency.get(e.target)?.add(e.source);
  }

  const seen = new Set<string>();
  const out: ConnectedComponent[] = [];
  for (const n of nodes) {
    if (seen.has(n.id)) continue;
    const stack = [n.id];
    const groupIds = new Set<string>();
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      groupIds.add(cur);
      for (const neighbor of adjacency.get(cur) ?? []) {
        if (!seen.has(neighbor)) stack.push(neighbor);
      }
    }
    out.push({ nodes: nodes.filter((nn) => groupIds.has(nn.id)) });
  }
  return out;
}
