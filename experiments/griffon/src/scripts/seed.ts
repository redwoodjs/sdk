import { db } from "../db";
import { defineScript } from "./defineScript";

export default defineScript(async () => {
  await db.$executeRawUnsafe(`\
    DELETE FROM Sensor;
    DELETE FROM SensorDataLog;
    DELETE FROM User;
    DELETE FROM sqlite_sequence;
  `);

  const user = await db.user.create({
    data: {
      id: '1',
      email: "her.stander@gmail.com",
    },
  });

  const sensor = await db.sensor.create({
    data: {
      id: '1',
      name: "sensor",
      userId: user.id,
      uniqueId: "1",
    },
  }); 

  await db.sensorDataLog.create({
    data: {
      id: '1',
      sensorId: sensor.id,
      data: {
        temperature: 20,
        humidity: 50,
      },
    },
  });

  console.log("Done seeding!");
});
