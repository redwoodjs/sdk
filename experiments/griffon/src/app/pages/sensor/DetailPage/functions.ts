"use server";

import {
  type Sensor,
} from "@prisma/client";
import { db } from "../../../../db";

export async function saveSensor(id: string, sensor: Omit<Sensor, 'data'>, userId: string) {
  console.log("saveSensor", id, sensor, userId);
  await db.sensor.findFirstOrThrow({
    where: {
      id,
      userId
    }
  })

  const data: Sensor = {
    ...sensor,
  }

  await db.sensor.upsert({
    create: data,
    update: data,
    where: {
      id,
    }
  })
}

export async function deleteSensor(id: string, userId: string) {
  await db.sensor.findFirstOrThrow({
    where: {
      id,
      userId
    }
  })

  await db.sensor.delete({
    where: {
      id,
      userId
    }
  })
}
