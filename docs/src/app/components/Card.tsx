/**
 * Stub for Starlight's <Card> component.
 * Renders as a simple bordered div.
 */
export function Card({
  title,
  icon,
  children,
}: {
  title?: string;
  icon?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card">
      {title && <h3 className="card-title">{title}</h3>}
      {children}
    </div>
  );
}

export function CardGrid({ children }: { children?: React.ReactNode }) {
  return <div className="card-grid">{children}</div>;
}
