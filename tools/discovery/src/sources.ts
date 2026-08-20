import type { DiscoverySource } from "./types.js";

export interface GitHubRepositoryTreeConfiguration extends Record<string, unknown> {
  owner: string;
  repository: string;
  include_path_prefixes: string[];
  artifact_extensions: string[];
}

const defaultDiscoverySources: DiscoverySource[] = [
  {
    source_id: "github:dify-awesome-workflows",
    label: "Awesome Dify Workflow community DSL collection",
    adapter: "github_repository_tree",
    platform: "dify",
    configuration: {
      owner: "svcvit",
      repository: "Awesome-Dify-Workflow",
      include_path_prefixes: ["DSL/"],
      artifact_extensions: [".yaml", ".yml"],
    } satisfies GitHubRepositoryTreeConfiguration,
  },
  {
    source_id: "github:n8n-community-workflows",
    label: "n8n community Workflow collection",
    adapter: "github_repository_tree",
    platform: "n8n",
    configuration: {
      owner: "Zie619",
      repository: "n8n-workflows",
      include_path_prefixes: ["workflows/"],
      artifact_extensions: [".json"],
    } satisfies GitHubRepositoryTreeConfiguration,
  },
  {
    source_id: "github:n8n-official-starter-kit",
    label: "n8n official self-hosted AI starter kit",
    adapter: "github_repository_tree",
    platform: "n8n",
    configuration: {
      owner: "n8n-io",
      repository: "self-hosted-ai-starter-kit",
      include_path_prefixes: ["n8n/demo-data/workflows/"],
      artifact_extensions: [".json"],
    } satisfies GitHubRepositoryTreeConfiguration,
  },
];

export const DEFAULT_DISCOVERY_SOURCES = defaultDiscoverySources
  .sort((left, right) => left.source_id.localeCompare(right.source_id, "en"));

export function isGitHubRepositoryTreeConfiguration(
  value: Record<string, unknown>,
): value is GitHubRepositoryTreeConfiguration {
  const owner = value.owner;
  const repository = value.repository;
  const prefixes = value.include_path_prefixes;
  const extensions = value.artifact_extensions;
  return typeof owner === "string"
    && /^[A-Za-z0-9_.-]+$/.test(owner)
    && typeof repository === "string"
    && /^[A-Za-z0-9_.-]+$/.test(repository)
    && Array.isArray(prefixes)
    && prefixes.length > 0
    && prefixes.every((prefix) => typeof prefix === "string" && prefix.length > 0)
    && Array.isArray(extensions)
    && extensions.length > 0
    && extensions.every((extension) => typeof extension === "string" && /^\.[a-z0-9]+$/.test(extension));
}
