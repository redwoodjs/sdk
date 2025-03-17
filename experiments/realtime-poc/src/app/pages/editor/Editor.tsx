"use client";
import { useState, useCallback } from "react";
import debounce from "lodash/debounce";
import { updateContent, getContent } from "./functions";
import { RouteContext } from "redwoodsdk/router";

export const Editor = async (ctx: RouteContext) => {
  const key = ctx.params.key;
  const [content, setContent] = useState<string>(await getContent(key, ctx));

  const debouncedUpdate = useCallback(
    debounce(async (newContent: string) => {
      try {
        await updateContent(key, newContent);
      } catch (error) {
        console.error("Error updating content:", error);
      }
    }, 1000),
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    debouncedUpdate(newContent);
  };

  return (
    <textarea
      value={content}
      onChange={handleChange}
      placeholder="Start typing..."
      style={{ width: "100%", height: "300px", fontSize: "16px" }}
    />
  );
};
