"use server";

import { Layout } from "../../Layout";

import { RouteContext } from "../../../../lib/router";
import { db } from "../../../../db";
import { BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "src/components/ui/breadcrumb";
import { link } from "src/shared/links";
import { SensorForm } from "./SensorForm";

export async function getSensor(id: string, userId: string) {
  const sensor = await db.sensor.findFirstOrThrow({
    where: {
      id,
      userId,
    },
  });

  return {
    ...sensor,
  };
}

export default async function SensorDetailPage({
  params,
  ctx,
}: RouteContext<{ id: string }>) {
  const sensor = await getSensor(params.id, ctx.user.id);

  return (
    <Layout ctx={ctx}>
      <BreadcrumbList>
        <BreadcrumbLink href={link('/sensor/list')}>
        Sensors
        </BreadcrumbLink>
        <BreadcrumbSeparator />
        <BreadcrumbPage>
        Edit Sensor
        </BreadcrumbPage>
      </BreadcrumbList>

      <SensorForm sensor={sensor} ctx={ctx} />
    </Layout>
  );
}
