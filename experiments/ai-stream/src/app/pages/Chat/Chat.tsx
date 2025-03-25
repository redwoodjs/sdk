"use client";

import { sendMessage } from "./functions";
import { useState } from "react";
import { consumeEventStream } from "@redwoodjs/sdk/client";

export function Chat() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");

  const onClick = async () => {
    setReply(""); // Reset reply before new message
    (await sendMessage(message)).pipeTo(
      consumeEventStream({
        onChunk: (event) => {
          setReply(
            (prev) =>
              prev +
              (event.data === "[DONE]" ? "" : JSON.parse(event.data).response),
          );
        },
      }),
    );
  };

  return (
    <div>
      <input
        type="text"
        value={message}
        placeholder="Type a message..."
        onChange={(e) => setMessage(e.target.value)}
        style={{
          width: "80%",
          padding: "10px",
          marginRight: "8px",
          borderRadius: "4px",
          border: "1px solid #ccc",
        }}
      />
      <button
        onClick={onClick}
        style={{
          padding: "10px 20px",
          borderRadius: "4px",
          border: "none",
          backgroundColor: "#007bff",
          color: "white",
          cursor: "pointer",
        }}
      >
        Send
      </button>
      <div>{reply}</div>
    </div>
  );
}
