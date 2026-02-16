/**
 * Stub for Starlight's <Steps> component.
 * Just renders children (expects an <ol> inside).
 */
export function Steps({ children }: { children?: React.ReactNode }) {
  return <div className="steps">{children}</div>;
}
