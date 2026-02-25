import { Callout } from "fumadocs-ui/components/callout";

const typeMap: Record<string, "info" | "warn" | "error"> = {
  note: "info",
  tip: "info",
  caution: "warn",
  danger: "error",
};

export function Aside({
  type = "note",
  title,
  children,
}: {
  type?: "note" | "tip" | "caution" | "danger";
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <Callout type={typeMap[type] ?? "info"} title={title}>
      {children}
    </Callout>
  );
}
