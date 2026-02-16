/**
 * Stub replacement for starlight-package-managers.
 */
export function PackageManagers({
  pkg,
  type = "add",
}: {
  pkg?: string;
  type?: string;
}) {
  return (
    <pre className="package-managers">
      <code>{`pnpm ${type === "exec" ? "dlx" : type} ${pkg || ""}`}</code>
    </pre>
  );
}
