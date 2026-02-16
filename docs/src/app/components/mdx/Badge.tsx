/**
 * Stub for Starlight's <Badge> component.
 * Renders as an inline span.
 */
export function Badge({
  text,
  variant = "default",
}: {
  text: string;
  variant?: "note" | "tip" | "caution" | "danger" | "default";
}) {
  return <span className={`badge badge--${variant}`}>{text}</span>;
}
