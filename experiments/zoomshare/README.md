# Zoomshare

This application receives a webhook from Zoom after a meeting's recording becomes available. The webhook allows this application to upload the video file into R2, transcribe it, and email the participants in the meeting a link to the video.

A Zoom Pro subscription is required, by default you only get 5 GB of Cloud Storage.


- [ ] Get zoom to hit the API

`meeting.recordings.completed` is the webhook that we're looking for: "this event will be triggered everytime a meeting is recorded, and the recording is ready to download."

```json
{
  "payload": {
    "account_id": "account_id",
    "object": {
      "uuid": "WEz4RT2lSyKx2MD9Z+lYfA==",
      "id": 87565330005,
      "account_id": "account_id",
      "host_id": "host_id",
      "topic": "Recordings download URL/access token 01",
      "type": 2,
      "start_time": "2023-12-01T20:01:56Z",
      "timezone": "America/New_York",
      "host_email": "elisa@tests.com",
      "duration": 1,
      "total_size": 3500663,
      "recording_count": 3,
      "share_url": "https://us02web.zoom.us/rec/share/ZUrD3XZS2qn5nW5IZLynVU",
      "recording_files": [
        {
          "id": "23e2a1b0-b119-4262-a0e4-8eaeecad8b5f",
          "meeting_id": "WEz4RT2lSyKx2MD9Z+lYfA==",
          "recording_start": "2023-12-01T20:02:05Z",
          "recording_end": "2023-12-01T20:03:14Z",
          "file_type": "M4A",
          "file_extension": "M4A",
          "file_size": 1107341,
          "play_url": "https://us02web.zoom.us/rec/play/14q-E-5ZFajTKl7vOJtEeWYUjjogV",
          "download_url": "https://us02web.zoom.us/rec/webhook_download/14q-E-JtEehWe",
          "status": "completed",
          "recording_type": "audio_only"
        },
        {
          "id": "4608677c-357d-439d-bbec-64bb69f5a9da",
          "meeting_id": "WEz4RT2lSyKx2MD9Z+lYfA==",
          "recording_start": "2023-12-01T20:02:05Z",
          "recording_end": "2023-12-01T20:03:14Z",
          "file_type": "MP4",
          "file_extension": "MP4",
          "file_size": 1285981,
          "play_url": "https://us02web.zoom.us/rec/play/1V_tamcytBlEGFy49aEe-YbJDejjF9",
          "download_url": "https://us02web.zoom.us/rec/webhook_download/1V_tamcytBlE9U",
          "status": "completed",
          "recording_type": "shared_screen_with_speaker_view"
        }
      ],
      "password": "password",
      "participant_audio_files": [
        {
          "id": "f47b467c-0cc3-49bf-b45d-f309beda9b1c",
          "recording_start": "2023-12-01T20:02:05Z",
          "recording_end": "2023-12-01T20:03:14Z",
          "file_name": "Audio only - Elisa L",
          "file_type": "M4A",
          "file_extension": "M4A",
          "file_size": 1107341,
          "play_url": "https://us02web.zoom.us/rec/play/yz-n0_izlWqOZ-MQu_5eWHG5-WOz7CF",
          "download_url": "https://us02web.zoom.us/rec/webhook_download/yz-n0_izlWqO97Q",
          "status": "completed"
        }
      ],
      "recording_play_passcode": "passcode",
      "on_prem": false
    }
  },
  "event_ts": 1701461193266,
  "event": "recording.completed",
  "download_token": "eyJhbGciOiJIUzUxMiJ9.eyJpc3MiOiJodHRwczovL2V2ZW50Lnpvb20udXMiLCJhY2NvdW50SWQiOiJsS2hrVklqTlN1eWxoQ1JIczduWnp3IiwiYXVkIjoiaHR0cHM6Ly9vYXV0aC56b29tLnVzIiwibWlkIjoiV0V6NFJUMmxTeUt4Mk1EOVorbFlmQT09IiwiZXhwIjoxNzAxNTQ3NjA4LCJ1c2VySWQiOiI2R3RkaGVaUVNxLWwySmxGVzZ2TEZ3In0.1MTJIH2WB0r1BjyzMd95hg1cnLvG-vGBjqxq1DlY976xIkcqs1P0wvOy9lEaENuHjcePfMvjsepH5mTUkqnDBw"
}
```

```
curl --location --request GET '{download_url}' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer {download_token}' \
--output '/path/to/download.file'
```

- [ ] Store the payload

We'll save this in a prisma in a table called `Recording`

- [ ] Upload to R2

Easy.

- [ ] Share with meeting particpants.

To get email address: Meeting requires registration to join.

This is done via the reports api;
https://developers.zoom.us/docs/api/meetings/#tag/reports/GET/report/meetings/{meetingId}/participants
