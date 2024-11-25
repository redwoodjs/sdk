import { db } from '../db';

export default async function HomePage() {
    let users = await db.user.findMany();
    if (users.length === 0) {
        await db.user.create({
            data: {
                name: 'Steve',
                cellnumber: '1234567890',
            },
        });
        users = await db.user.findMany();
    }

    return ['home', JSON.stringify(users)].join('\n');
}