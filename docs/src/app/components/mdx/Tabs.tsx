/**
 * Stubs for Starlight's <Tabs> and <TabItem> components.
 * Renders all tab items stacked (no tab switching in this POC).
 */
export function Tabs({ children }: { children?: React.ReactNode }) {
  return <div className="tabs">{children}</div>;
}

export function TabItem({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="tab-item">
      <strong className="tab-label">{label}</strong>
      {children}
    </div>
  );
}
