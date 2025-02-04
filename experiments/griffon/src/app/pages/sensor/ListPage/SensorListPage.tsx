"use server";

import { Layout } from "../../Layout";

import { CreateSensorButton } from "./CreateSensorButton";
import { db } from "../../../../db";
import { RouteContext } from "../../../../lib/router";
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

type Sensor = {
  id: string;
  name: string;
  uniqueId: string;
};

export type InvoiceItem = {
  description: string;
  price: number;
  quantity: number;
};

export type InvoiceTaxes = {
  description: string;
  amount: number;
};

async function getSensorListSummary(userId: string) {
  const sensors =
    (await db.sensor.findMany({
      select: {
        id: true,
        name: true,
        uniqueId: true,
      },
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    })) ?? [];

  console.log("### sensors", sensors);

  return sensors.map((sensor: Sensor) => {
    const { id, name, uniqueId } = sensor;
    return {
      id,
      name,
      uniqueId,
    };
  });
}

export default async function SensorListPage({ ctx }: RouteContext) {
  const sensors = await getSensorListSummary(ctx.user.id);
  return (
    <Layout ctx={ctx}>
      <div className="space-y-2 py-4 text-right">
        <CreateSensorButton />
      </div>

      <div className="text-sm text-gray-500">
        Post data to: /api/sensor/{ctx.user.id}/data
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
        <TableBody>
          {sensors.length === 0 && (
            <TableRow>
              <TableCell colSpan={4}>No sensors found</TableCell>
            </TableRow>
          )}
          {sensors.map((s: Sensor) => (
            <SensorListItem {...s} key={"sensor-" + s.id} />
          ))}
        </TableBody>
      </Table>
    </Layout>
  );
}

function SensorListItem(
  props: Awaited<ReturnType<typeof getSensorListSummary>>[number],
) {
  return (
    <TableRow>
      <TableCell>
        <a href={link("/sensor/:id", { id: props.id })}>{props.name}</a>
      </TableCell>
      <TableCell>
        {props.uniqueId}
      </TableCell>
      <TableCell className="text-right">
      <a href={link("/sensor/:id", { id: props.id })}>Edit</a>
      </TableCell>
    </TableRow>
  );
}
