export function StatusBadge({ verified }: { verified: boolean }) {
  return (
    <span className={verified ? "status verified" : "status pending"}>
      <span aria-hidden="true">{verified ? "✓" : "○"}</span>
      {verified ? "Verified" : "Review pending"}
    </span>
  );
}
