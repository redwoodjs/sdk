import { db, index, route } from "@redwoodjs/reloaded/worker";
import InvoiceDetailPage from "./DetailPage/InvoiceDetailPage";
import InvoiceListPage from "./ListPage/InvoiceListPage";

export const invoiceRoutes = [
  index(function () {
    // redirect to invoice/list
    return new Response(null, {
      status: 301,
      headers: {
        Location: "/invoice/list",
      },
    });
  }),
  route("/list", InvoiceListPage),
  route("/:id", InvoiceDetailPage),
  route("/:id/upload", async ({ request, params, env, ctx }) => {
    if (
      request.method !== "POST" &&
      !request.headers.get("content-type")?.includes("multipart/form-data")
    ) {
      return new Response("Method not allowed", { status: 405 });
    }
    // todo get userId from context.

    const formData = await request.formData();
    const file = formData.get("file") as File;

    // Stream the file directly to R2
    const r2ObjectKey = `/invoice/logos/${ctx.user.id}/${params.id}-${Date.now()}-${file.name}`;
    await env.R2.put(r2ObjectKey, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    await db.invoice.update({
      where: { id: params.id },
      data: {
        supplierLogo: r2ObjectKey,
      },
    });

    return new Response(JSON.stringify({ key: r2ObjectKey }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }),
  route("/logos/*", async ({ params, env }) => {
    const object = await env.R2.get('/invoice/logos/' + params.$0);
    if (object === null) {
      return new Response("Object Not Found", { status: 404 });
    }
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType as string,
      },
    });
  }),
];
