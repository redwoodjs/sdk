"use server";

import { HandlerOptions } from "@redwoodjs/sdk/router";

export async function sendMessage(message: string, opts?: HandlerOptions) {
  const response = await opts!.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
    prompt: message,
    stream: true,
  });

  return response as unknown as ReadableStream;
}
