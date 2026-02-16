/**
 * Stub for Starlight's <FileTree> component.
 * Just renders children (expects a nested list).
 */
export function FileTree({ children }: { children?: React.ReactNode }) {
  return <div className="file-tree">{children}</div>;
}
