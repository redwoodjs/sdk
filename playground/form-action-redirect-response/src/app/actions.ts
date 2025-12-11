"use server";
export const handleForm = (formData: FormData) => {
  return new Response(null, { status: 303, headers: { Location: "/test" } });
};