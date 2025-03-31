import { db } from "src/db";
import { index, route } from "@redwoodjs/sdk/router";
import { InvoiceDetailPage } from "./DetailPage/InvoiceDetailPage";
import { InvoiceListPage } from "./ListPage/InvoiceListPage";
import { link } from "src/shared/links";

function isAuthenticated({ appContext }) {
  if (!appContext.user) {
    return new Response(null, {
      status: 302,
      headers: { Location: link("/") },
    });
  }
}

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
  route("/list", [isAuthenticated, InvoiceListPage]),
  route("/:id", [isAuthenticated, InvoiceDetailPage]),
  route("/:id/upload", [
    isAuthenticated,
    async ({ request, params, env, appContext }) => {
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
      const r2ObjectKey = `/invoice/logos/${appContext.user.id}/${params.id}-${Date.now()}-${file.name}`;
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
    },
  ]),
  route("/logos/*", [
    isAuthenticated,
    async ({ params, env }) => {
      const object = await env.R2.get("/invoice/logos/" + params.$0);
      if (object === null) {
        return new Response("Object Not Found", { status: 404 });
      }
      return new Response(object.body, {
        headers: {
          "Content-Type": object.httpMetadata?.contentType as string,
        },
      });
    },
  ]),
];
