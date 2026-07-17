"use client";

import { useMemo, useState } from "react";
import type { RegistryWorkflow } from "@/lib/registry";
import { WorkflowCard } from "./workflow-card";

export function WorkflowFilters({ workflows }: { workflows: RegistryWorkflow[] }) {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("All platforms");
  const [category, setCategory] = useState("All categories");

  const platforms = ["All platforms", ...new Set(workflows.map((item) => item.platform))];
  const categories = ["All categories", ...new Set(workflows.flatMap((item) => item.categories))];

  const filtered = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase("en");

      return workflows.filter((item) => {
        const searchableText = [
          item.name,
          item.description,
          item.platform,
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

  return (
    <>
      <div className="filter-panel" aria-label="Workflow filters">
        <label className="search-filter">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, platform, category, or tag"
          />
        </label>
        <label>
          <span>Platform</span>
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            {platforms.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <p className="result-count" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "workflow" : "workflows"}
        </p>
      </div>
      {filtered.length ? (
        <div className="workflow-grid">
          {filtered.map((workflow) => (
            <WorkflowCard workflow={workflow} key={workflow.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No workflows found</h2>
          <p>Try another search term, platform, or category.</p>
        </div>
      )}
    </>
  );
}
