import { db } from "@/db"


export async function MeetingDetail({ params }) {

    const recordings = await db.recording.findMany({
        where: {
            meetingId: params.meetingId
        }
    })
    
    return <div>
        <h2>Meeting Detail</h2>
        <ul>
            {recordings.map((recording) => (
                <li key={recording.id}>
                    <a href={recording.downloadUrl}>{recording.type}</a>
                    <br />
                    {recording.startTime.toLocaleString()} - {recording.endTime.toLocaleString()}
                    <br />
                    {recording.size}k
                </li>
            ))}
        </ul>
    </div>
}