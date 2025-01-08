import { db } from '../db';
import { defineScript } from './defineScript';

export default defineScript(async () => {
  await db.user.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      email: 'test@test.com',
    },
  });

  console.log('Done seeding!')
})