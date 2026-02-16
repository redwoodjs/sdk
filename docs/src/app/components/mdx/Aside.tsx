/**
 * Stub for Starlight's <Aside> component.
 * Renders as a styled blockquote with a type indicator.
 */
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
    <blockquote className={`aside aside--${type}`}>
      {title && <strong className="aside-title">{title}</strong>}
      {children}
    </blockquote>
  );
}
