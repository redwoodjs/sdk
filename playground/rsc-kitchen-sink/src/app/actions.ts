"use server";

export async function formAction(formData: FormData) {
  const text = formData.get("text") as string;
  return `Message from form action: ${text || "No text entered"}`;
}

export async function onClickAction() {
  return `Message from onClick action at ${new Date().toLocaleTimeString()}`;
}
