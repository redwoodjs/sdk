"use client";
import { useState } from "react";

const Home = () => {
  const [content, setContent] = useState<string>("");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
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
