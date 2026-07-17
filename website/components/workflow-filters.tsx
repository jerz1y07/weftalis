"use client";

import { useMemo, useState } from "react";
import type { Workflow } from "@/lib/workflows";
import { WorkflowCard } from "./workflow-card";

export function WorkflowFilters({ workflows }: { workflows: Workflow[] }) {
  const [platform, setPlatform] = useState("All platforms");
  const [category, setCategory] = useState("All categories");

  const platforms = ["All platforms", ...new Set(workflows.map((item) => item.platform))];
  const categories = ["All categories", ...new Set(workflows.map((item) => item.category))];

  const filtered = useMemo(
    () =>
      workflows.filter(
        (item) =>
          (platform === "All platforms" || item.platform === platform) &&
          (category === "All categories" || item.category === category),
      ),
    [category, platform, workflows],
  );

  return (
    <>
      <div className="filter-panel" aria-label="Workflow filters">
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
            <WorkflowCard workflow={workflow} key={workflow.slug} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No workflows match these filters</h2>
          <p>Try selecting a different platform or category.</p>
        </div>
      )}
    </>
  );
}
