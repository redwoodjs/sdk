"use client";

import { sendMessage } from "./functions";
import { useState } from "react";
import { useEventStream } from "@redwoodjs/sdk/client";

export function Chat() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const eventStream = useEventStream({
    onEvent: (event) => {
      setReply((prev) => prev + JSON.parse(event.data).response);
    },
  });

  const onClick = async () => {
    setReply(""); // Reset reply before new message
    (await sendMessage(message)).pipeTo(eventStream());
  };

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button onClick={onClick}>Send</button>
      <div>{reply}</div>
    </div>
  );
}
