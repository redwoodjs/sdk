import { Card } from "fumadocs-ui/components/card";

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
    <Card title={title} description={description} href={href} />
  );
}
