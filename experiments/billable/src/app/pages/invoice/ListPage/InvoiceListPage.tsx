"use server";

import { Layout } from "../../Layout";

import { CreateInvoiceButton } from "./CreateInvoiceButton";
import { db } from "src/db";
import { RouteOptions } from "@redwoodjs/sdk/router";
import { link } from "src/shared/links";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "src/components/ui/table";

export type InvoiceItem = {
  description: string;
  price: number;
  quantity: number;
};

export type InvoiceTaxes = {
  description: string;
  amount: number;
};

async function getInvoiceListSummary(userId: string) {
  const invoices =
    (await db.invoice.findMany({
      select: {
        id: true,
        number: true,
        date: true,
        status: true,
        customer: true,
      },
      where: {
        userId,
      },
      orderBy: {
        date: "desc",
      },
    })) ?? [];

  return invoices.map((invoice) => {
    const { id, date, number, customer, status } = invoice;
    return {
      id,
      date,
      number,
      customer: customer?.split("\n")[0] || "",
      status,
    };
  });
}

export async function InvoiceListPage({ appContext }: RouteOptions) {
  const invoices = await getInvoiceListSummary(appContext.user.id);
  return (
    <Layout appContext={appContext}>
      <div className="space-y-2 py-4 text-right">
        <CreateInvoiceButton />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        {invoices.length === 0 && (
          <TableCaption>No invoices found</TableCaption>
        )}
        <TableBody>
          {invoices.map((i) => (
            <InvoiceListItem {...i} key={"invoice-" + i.id} />
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}

function InvoiceListItem(
  props: Awaited<ReturnType<typeof getInvoiceListSummary>>[number],
) {
  return (
    <TableRow>
      <TableCell>
        <a href={link("/invoice/:id", { id: props.id })}>{props.number}</a>
      </TableCell>
      <TableCell>
        {props.date.toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </TableCell>
      <TableCell>{props.customer}</TableCell>
      <TableCell className="text-right">
        <a href={link("/invoice/:id", { id: props.id })}>Edit</a>
      </TableCell>
    </TableRow>
  );
}
