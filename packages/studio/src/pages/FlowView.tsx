import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type NodeProps,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useApi } from "../hooks/use-api";
import { useColors } from "../hooks/use-colors";
import type { Theme } from "../hooks/use-theme";
import type { TFunction } from "../hooks/use-i18n";
import { layoutStoryGraph } from "../lib/story-flow-layout";
import type { StoryGraph } from "@actalk/inkos-core/interactive-film/graph-schema";

interface Nav {
  toDashboard: () => void;
  toFilm: (id: string) => void;
}

// v12: define Node type with data shape, then use NodeProps<StoryNode>
type StoryNode = Node<{ label: string; nodeType: string }, "story">;

const TYPE_COLOR: Record<string, string> = {
  start: "bg-emerald-100 border-emerald-400",
  branch: "bg-amber-100 border-amber-400",
  ending: "bg-rose-100 border-rose-400",
  merge: "bg-sky-100 border-sky-400",
  explore: "bg-violet-100 border-violet-400",
  normal: "bg-slate-100 border-slate-300",
};

function StoryFlowNode({ id, data }: NodeProps<StoryNode>) {
  const cls = TYPE_COLOR[data.nodeType] ?? TYPE_COLOR.normal;
  return (
    <div
      data-testid={`flow-node-${id}`}
      className={`px-3 py-2 rounded border text-xs ${cls}`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="font-medium">{data.label}</div>
      <div className="opacity-60">{data.nodeType}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// Module-level constant so nodeTypes reference is stable across renders
const nodeTypes = { story: StoryFlowNode };

export default function FlowView({
  projectId,
  nav,
  theme,
  t,
}: {
  projectId: string;
  nav: Nav;
  theme: Theme;
  t: TFunction;
}) {
  const c = useColors(theme);
  const { data: graph, loading, error } = useApi<StoryGraph>(
    `/projects/${projectId}/story-graph`,
  );
  const { nodes, edges } = useMemo(
    () => (graph ? layoutStoryGraph(graph) : { nodes: [], edges: [] }),
    [graph],
  );

  if (loading) return <div className={c.muted}>{t("common.loading")}</div>;
  if (error)
    return (
      <div className="text-red-400">
        {t("common.error")}: {error}
      </div>
    );
  if (!graph) return null;

  return (
    <div className="space-y-3" data-testid="flow-view">
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => nav.toFilm(projectId)}
          className={c.link}
          data-testid="flow-back"
        >
          ← {t("bread.film")}
        </button>
        <span data-testid="flow-title">{graph.title || projectId}</span>
      </div>
      <div style={{ height: "70vh" }} className="border rounded">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          colorMode={theme === "dark" ? "dark" : "light"}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
