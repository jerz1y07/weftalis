"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  formatPublicLabel,
  getMarketplaceWorkflow,
  type RegistryWorkflow,
} from "@/lib/registry";
import { WorkflowCard } from "./workflow-card";

export function WorkflowFilters({ workflows }: { workflows: RegistryWorkflow[] }) {
  const searchParams = useSearchParams();
  const requestedPlatform = searchParams.get("platform");
  const requestedCategory = searchParams.get("category");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [platform, setPlatform] = useState(
    workflows.some((item) => item.platform === requestedPlatform)
      ? requestedPlatform ?? "All platforms"
      : "All platforms",
  );
  const [category, setCategory] = useState(
    workflows.some((item) => item.categories.includes(requestedCategory ?? ""))
      ? requestedCategory ?? "All categories"
      : "All categories",
  );

  const platforms = ["All platforms", ...new Set(workflows.map((item) => item.platform))];
  const categories = ["All categories", ...new Set(workflows.flatMap((item) => item.categories))];

  const filtered = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase("en");

      return workflows.filter((item) => {
        const marketplace = getMarketplaceWorkflow(item);
        const searchableText = [
          item.name,
          marketplace.summary,
          item.platform,
          marketplace.originalCreator ?? "",
          marketplace.sourceLabel,
          ...item.categories,
          ...item.tags,
        ].join(" ").toLocaleLowerCase("en");

        return (
          (normalizedQuery.length === 0 || searchableText.includes(normalizedQuery)) &&
          (platform === "All platforms" || item.platform === platform) &&
          (category === "All categories" || item.categories.includes(category))
        );
      });
    },
    [category, platform, query, workflows],
  );

  function clearFilters() {
    setQuery("");
    setPlatform("All platforms");
    setCategory("All categories");
  }

  return (
    <>
      <div className="filter-panel" aria-label="Workflow filters">
        <label className="directory-search">
          <span>Search workflows</span>
          <div className="search-input-wrap">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try “research”, “Dify”, or a creator"
            />
          </div>
        </label>
        <div className="filter-controls">
          <label>
            <span>Platform</span>
            <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
              {platforms.map((option) => (
                <option value={option} key={option}>
                  {option === "All platforms" ? option : formatPublicLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Use case</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((option) => (
                <option value={option} key={option}>
                  {option === "All categories" ? "All use cases" : formatPublicLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <button className="clear-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
        <div className="filter-summary">
          <p className="result-count" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "workflow" : "workflows"}
          </p>
          <p>Alphabetical order</p>
        </div>
      </div>
      {filtered.length ? (
        <div className="workflow-list">
          {filtered.map((workflow) => (
            <WorkflowCard workflow={workflow} key={workflow.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No workflows found</h2>
          <p>Try another search term, platform, or category.</p>
          <button className="button secondary-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}
    </>
  );
}
