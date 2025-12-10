"use server";

export async function formActionWithRedirect(formData: FormData) {
  const name = formData.get("name") as string;

  if (!name) {
    return { error: "Name is required" };
  }

  throw new Response(null, {
    status: 302,
    headers: {
      Location: "/success?from=form&name=" + encodeURIComponent(name),
    },
  });
}

export async function onClickActionWithRedirect() {
  throw new Response(null, {
    status: 302,
    headers: {
      Location: "/success?from=onclick",
    },
  });
}

