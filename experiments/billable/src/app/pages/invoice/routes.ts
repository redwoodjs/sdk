import { db } from "../../../db";
import { index, route } from "../../../router";
import InvoiceDetailPage from "./DetailPage/InvoiceDetailPage";
import InvoiceListPage from "./ListPage/InvoiceListPage";

export const invoiceRoutes = [
  index(function() {
    // redirect to invoice/list
    return new Response(null, {
      status: 301,
      headers: {
        'Location': '/invoice/list'
      }
    })
  }),
  route("/list", InvoiceListPage),
  route("/:id", InvoiceDetailPage),
  route("/:id/upload", async ({ request, env }) => {
    if (
      request.method === "POST" &&
      request.headers.get("content-type")?.includes("multipart/form-data")
    ) {
      // todo get userId from context.

      const formData = await request.formData();
      const userId = formData.get("userId") as string;
      const invoiceId = formData.get("invoiceId") as string;
      const file = formData.get("file") as File;

      // Stream the file directly to R2
      const r2ObjectKey = `/invoice/logos/${userId}/${invoiceId}-${Date.now()}-${file.name}`;
      await env.R2.put(r2ObjectKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });

      await db.invoice.update({
        where: { id: invoiceId },
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
    }
    return new Response("Method not allowed", { status: 405 });
  }),
  route("/logos/*", async ({ params, env }) => {
    const object = await env.R2.get(params.$0);
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

// rename this to something a bit more explicit.
