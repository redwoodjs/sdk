"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/Button";
import { CheckIcon, ClipboardIcon } from "@/app/components/ui/Icon";

export function CopyMarkdownButton({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="secondary"
      onClick={handleCopy}
    >
      {copied ? (
        <>
          <CheckIcon className="size-3.5" />
          Copied!
        </>
      ) : (
        <>
          <ClipboardIcon className="size-3.5" />
          Copy Markdown
        </>
      )}
    </Button>
  );
}
