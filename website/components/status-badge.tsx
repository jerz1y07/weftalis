import type { ValidationStatus } from "@/lib/registry";

export function StatusBadge({ status }: { status: ValidationStatus }) {
  const passed = status === "valid";

  return (
    <span className={passed ? "status verified" : "status pending"}>
      <span aria-hidden="true">{passed ? "✓" : "○"}</span>
      {passed ? "Validation passed" : "Validation pending"}
    </span>
  );
}
