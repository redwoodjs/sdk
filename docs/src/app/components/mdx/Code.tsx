/**
 * Stub for Starlight's <Code> component.
 * Renders as a plain <pre> block.
 */
export function Code({
  code,
  lang,
}: {
  code: string;
  lang?: string;
  title?: string;
}) {
  return (
    <pre className="code-block">
      <code className={lang ? `language-${lang}` : ""}>{code}</code>
    </pre>
  );
}
