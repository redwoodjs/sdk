"use server";

import { Layout } from "../../Layout";

import { InvoiceForm } from "./CutlistForm";
import { RouteContext } from "../../../../lib/router";
import { db } from "../../../../db";
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";

export type CutlistItem = {
  title: string;
  width: number;
  length: number;
  quantity: number;
  price: number;
  currency: string;
};


export async function getCutlist(id: string, userId: string) {
  const cutlist = await db.cutlist.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });

  return {
    ...cutlist,
    cutlistItems: JSON.parse(cutlist.cutlistItems) as CutlistItem[],
  };
}

export default async function InvoiceDetailPage({
  params,
  ctx,
}: RouteContext<{ id: string }>) {
  const cutlist = await getCutlist(params.id, ctx.user.id);

  return (
    <Layout ctx={ctx}>
      <BreadcrumbList>
        <BreadcrumbLink href={link('/project/list')}>
        Cutlists
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>
        Edit Cutlist
        </BreadcrumbPage>
      </BreadcrumbList>

      <CutlistForm cutlist={cutlist} />
    </Layout>
  );
}
