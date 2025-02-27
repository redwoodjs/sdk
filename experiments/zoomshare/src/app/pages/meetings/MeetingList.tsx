import type { Context } from '@/worker'
import { db } from '@/db';




export async function MeetingList({ ctx }: { ctx: Context }) {

  const meetings = await db.meeting.findMany({
    orderBy: {
      createdAt: 'desc'
    }
  })
  
  return (
    <div>
      <h1>Meetings</h1>
      <ol>
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <a href={`/meetings/${meeting.id}`}>
              {meeting.topic}
            </a>
            <br />
            {meeting.startTime.toLocaleString()} {meeting.duration}
          </li>
        ))}
      </ol>
    </div>
  );
}
