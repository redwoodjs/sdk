"use client";
import { useState, useCallback } from "react";
import debounce from "lodash/debounce";
import { updateDocument } from "./functions";

const Home = () => {
  const [content, setContent] = useState<string>("");

  const debouncedUpdate = useCallback(
    debounce(async (newContent: string) => {
      try {
        await updateDocument(newContent);
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
