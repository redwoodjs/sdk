import { db } from '../db';

export default async function HomePage() {
    let users = await db.selectFrom('User').selectAll().execute();

    if (users.length === 0) {
        await db.insertInto('User')
          .values({
            name: 'Steve',
            cellnumber: '1234567890',
          })
          .execute();

        users = await db.selectFrom('User').selectAll().execute();
    }

    return ['home', JSON.stringify(users)].join('\n');
}