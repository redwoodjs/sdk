"use server";

export async function submitForm(formData: FormData) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/test",
    },
  });
}
