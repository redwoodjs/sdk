"use server";

export function serverAction(formData: FormData) {
  console.info("server action received", Object.fromEntries(formData.entries()));
}