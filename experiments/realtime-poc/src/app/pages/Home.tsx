"use client";
import { useState, useCallback } from "react";
import debounce from "lodash/debounce";
import { updateDocument, getDocument } from "./functions";

const Home = async () => {
  const key = window.location.pathname;
  const [content, setContent] = useState<string>(await getDocument(key));

  const debouncedUpdate = useCallback(
    debounce(async (newContent: string) => {
      try {
        await updateDocument(key, newContent);
      } catch (error) {
        console.error("Error updating document:", error);
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

export default Home;
