/**
 * Stub for Starlight's <LinkCard> component.
 * Renders as a simple link.
 */
export function LinkCard({
  title,
  description,
  href,
}: {
  title: string;
  description?: string;
  href: string;
}) {
  return (
    <a href={href} className="link-card">
      <strong>{title}</strong>
      {description && <span>{description}</span>}
    </a>
  );
}
