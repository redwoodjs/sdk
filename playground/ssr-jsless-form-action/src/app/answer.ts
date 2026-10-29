"use server";

import { recordAnswer } from "./answerState";

export async function answer(formData: FormData) {
  const text = formData.get("text");
  console.log("answer called", text);
  recordAnswer(typeof text === "string" ? text : "");
}
