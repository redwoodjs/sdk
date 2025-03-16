"use client";
import { useEffect, useState } from "react";

const Home = () => {
  const [content, setContent] = useState<string>("");
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(
      "wss://your-cloudflare-worker-domain/document",
    );

    socket.addEventListener("message", (event) => {
      console.log("[Realtime] New document content received");
      setContent(event.data);
    });

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);

    // ✅ Only send via WebSocket (no extra API call)
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(newContent);
    }
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
