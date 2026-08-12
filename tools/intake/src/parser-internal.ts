import type { AuditNode, StaticSignals } from "./types.js";

export interface ParsedWorkflow {
  platform: "dify" | "n8n";
  applicationOrWorkflowType: string | null;
  schemaIndicators: string[];
  nodes: AuditNode[];
  nodeCount: number;
  edgeCount: number;
  signals: StaticSignals;
  dependencies: {
    providers: string[];
    models: string[];
    plugins: string[];
    custom_nodes: string[];
    other: string[];
  };
  warnings: string[];
  uncertainties: string[];
}
