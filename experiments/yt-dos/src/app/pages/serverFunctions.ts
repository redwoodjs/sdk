"use server";

export async function fetchYoutubeVideos(
  searchTerm: string,
  apiKey: string,
  pageToken?: string,
) {
  const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
  const response = await fetch(
    `${YT_SEARCH_URL}?part=snippet&type=video&maxResults=10&q=${encodeURIComponent(searchTerm)}${pageToken ? `&pageToken=${pageToken}` : ""}&key=${apiKey}`,
  );
  return response.json();
}
