'use server';


import { db } from "../../../../db";
import { getContext } from "../../../../worker";



// We need to pass the context to these somehow?
export async function createSensor({ ctx }: { ctx: Awaited<ReturnType<typeof getContext>>}) {

  const userId = ctx.user.id

  // todo(peterp, 28-01-2025): Implement templates.
  let lastSensor = await db.sensor.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: 'desc',
    }
  })

  const newSensor = await db.sensor.create({
    data: {
      name: (Number(lastSensor?.uniqueId || 0) + 1).toString(),
      uniqueId: lastSensor?.uniqueId,
      userId
    }
  })

  return newSensor
}
