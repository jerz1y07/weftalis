import type { Platform, WorkflowAdapter } from "../types.js";

import { difyAdapter } from "./dify-adapter.js";
import { n8nAdapter } from "./n8n-adapter.js";

export class AdapterParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterParseError";
  }
}

export function getAdapter(platform: Platform): WorkflowAdapter {
  if (platform === "n8n") {
    return n8nAdapter;
  }
  return difyAdapter;
}
