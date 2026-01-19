"use server";

import { serverAction, serverQuery } from "rwsdk/worker";

export const getGreeting = serverQuery(async (name: string) => {
  return `Hello, ${name}! (from serverQuery GET)`;
});

export const getGreetingPost = serverQuery(async (name: string) => {
  return `Hello, ${name}! (from serverQuery POST)`;
}, { method: "POST" });

export const updateName = serverAction(async (name: string) => {
  console.log("Updating name to:", name);
  return { success: true, newName: name };
});

export default serverAction(async () => {
  return "Default action result";
});
