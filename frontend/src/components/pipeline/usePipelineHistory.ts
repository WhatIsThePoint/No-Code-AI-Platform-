import { useCallback, useRef, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";

const HISTORY_CAP = 50;

interface Snapshot {
  nodes: Node[];
  edges: Edge[];
}

interface UsePipelineHistoryArgs {
  initialNodes: Node[];
  initialEdges: Edge[];
}

interface UsePipelineHistory {
  nodes: Node[];
  edges: Edge[];
  /** Drop-in replacement for `setNodes` from useNodesState. */
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  /** Drop-in replacement for `setEdges` from useEdgesState. */
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  /** Drop-in replacement for `onNodesChange`. Snapshots on drag end + non-position changes. */
  onNodesChange: (changes: NodeChange[]) => void;
  /** Drop-in replacement for `onEdgesChange`. Snapshots on every change. */
  onEdgesChange: (changes: EdgeChange[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Manual snapshot — call before applying a transformation that goes through
   *  setNodes/setEdges directly (auto-layout, preset insert). */
  pushSnapshot: () => void;
}

/* eslint-disable react-hooks/exhaustive-deps -- the helpers below close over
 * refs only, so they're effectively stable; including them in dep arrays
 * would defeat memoization without changing correctness. */

/**
 * History-aware wrapper around React Flow's node/edge state.
 *
 * Drop-in replacement for the `useNodesState` + `useEdgesState` pair: returns
 * `{nodes, edges, setNodes, setEdges, onNodesChange, onEdgesChange}` plus
 * `undo`, `redo`, `pushSnapshot`. History entries snapshot the *previous*
 * state before a mutation lands so undo restores the value before the change.
 *
 * Drag coalescing: position-only changes (the per-frame stream React Flow
 * emits while dragging) only push a snapshot once `dragging: false` arrives,
 * i.e. on drag end. Selection-only changes never push a snapshot.
 */
export function usePipelineHistory({
  initialNodes,
  initialEdges,
}: UsePipelineHistoryArgs): UsePipelineHistory {
  const [nodes, setNodesRaw] = useState<Node[]>(initialNodes);
  const [edges, setEdgesRaw] = useState<Edge[]>(initialEdges);

  // Past = snapshots before each committed change (undo target).
  // Future = snapshots reverted into via undo, restored on redo.
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  // Current state mirror for use inside callbacks where the closure-captured
  // state would be stale.
  const current = useRef<Snapshot>({ nodes: initialNodes, edges: initialEdges });
  // Suppress history pushes when we're applying an undo/redo so the act of
  // restoring a snapshot doesn't itself become a history entry.
  const suppress = useRef(false);
  // Counter we bump when something changes so React re-evaluates canUndo/canRedo.
  const [, bump] = useState(0);

  const refresh = () => bump((n) => n + 1);

  const push = (snap: Snapshot) => {
    if (suppress.current) return;
    past.current.push(snap);
    if (past.current.length > HISTORY_CAP) past.current.shift();
    future.current = [];
    refresh();
  };

  const writeNodes = (next: Node[]) => {
    current.current = { nodes: next, edges: current.current.edges };
    setNodesRaw(next);
  };
  const writeEdges = (next: Edge[]) => {
    current.current = { nodes: current.current.nodes, edges: next };
    setEdgesRaw(next);
  };

  const setNodes: React.Dispatch<React.SetStateAction<Node[]>> = useCallback(
    (updater) => {
      const before = current.current.nodes;
      const next =
        typeof updater === "function"
          ? (updater as (n: Node[]) => Node[])(before)
          : updater;
      if (next === before) return;
      push({ nodes: before, edges: current.current.edges });
      writeNodes(next);
    },
    [],
  );

  const setEdges: React.Dispatch<React.SetStateAction<Edge[]>> = useCallback(
    (updater) => {
      const before = current.current.edges;
      const next =
        typeof updater === "function"
          ? (updater as (e: Edge[]) => Edge[])(before)
          : updater;
      if (next === before) return;
      push({ nodes: current.current.nodes, edges: before });
      writeEdges(next);
    },
    [],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.length === 0) return;

    // Decide whether to snapshot:
    //   - skip for selection-only changes (purely visual, not undoable)
    //   - skip for position changes still in-flight (`dragging === true`);
    //     only snapshot once on drag end (`dragging === false` for any
    //     position change in the batch)
    //   - snapshot for everything else (add, remove, dimensions changes
    //     that affect layout, parent changes, etc.)
    const onlySelection = changes.every((c) => c.type === "select");
    const positionChanges = changes.filter(
      (c): c is Extract<NodeChange, { type: "position" }> => c.type === "position",
    );
    const dragInFlight =
      positionChanges.length > 0 &&
      positionChanges.every((c) => c.dragging === true);
    const dragEnd =
      positionChanges.length > 0 &&
      positionChanges.some((c) => c.dragging === false);

    const shouldSnapshot = !onlySelection && !dragInFlight;

    if (shouldSnapshot) {
      push({ nodes: current.current.nodes, edges: current.current.edges });
    }
    void dragEnd;
    const next = applyNodeChanges(changes, current.current.nodes);
    if (next !== current.current.nodes) writeNodes(next);
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.length === 0) return;
    const onlySelection = changes.every((c) => c.type === "select");
    if (!onlySelection) {
      push({ nodes: current.current.nodes, edges: current.current.edges });
    }
    const next = applyEdgeChanges(changes, current.current.edges);
    if (next !== current.current.edges) writeEdges(next);
  }, []);

  const pushSnapshot = useCallback(() => {
    push({ nodes: current.current.nodes, edges: current.current.edges });
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const snap = past.current.pop()!;
    future.current.push({
      nodes: current.current.nodes,
      edges: current.current.edges,
    });
    if (future.current.length > HISTORY_CAP) future.current.shift();
    suppress.current = true;
    try {
      writeNodes(snap.nodes);
      writeEdges(snap.edges);
    } finally {
      suppress.current = false;
    }
    refresh();
  }, []);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const snap = future.current.pop()!;
    past.current.push({
      nodes: current.current.nodes,
      edges: current.current.edges,
    });
    if (past.current.length > HISTORY_CAP) past.current.shift();
    suppress.current = true;
    try {
      writeNodes(snap.nodes);
      writeEdges(snap.edges);
    } finally {
      suppress.current = false;
    }
    refresh();
  }, []);

  return {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    pushSnapshot,
  };
}
