import { db } from "@/db";

export async function MeetingDetail({ params }) {
  const recordings = await db.recording.findMany({
    where: {
      meetingId: params.meetingId,
    },
  });

  const meeting = await db.meeting.findUniqueOrThrow({
    where: {
      id: params.meetingId,
    },
  });

  return (
    <div>
      <h2>Meeting: {meeting.topic}</h2>
      <ul>
        {recordings.map((recording) => (
          <li key={recording.id}>
            <a href={`/meetings/${params.meetingId}/${recording.id}`}>
              {recording.type}
            </a>
            <br />
            {recording.startTime.toLocaleString()} -{" "}
            {recording.endTime.toLocaleString()}
            <br />
            {recording.size}k
          </li>
        ))}
      </ul>
    </div>
  );
}
