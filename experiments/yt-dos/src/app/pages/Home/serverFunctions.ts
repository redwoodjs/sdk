"use server";

export async function fetchYoutubeVideos(query: string, env: any) {
    const YT_API_KEY = env.YT_API_KEY;
    const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

    const response = await fetch(
        `${YT_SEARCH_URL}?part=snippet&type=video&q=${encodeURIComponent(
            query
        )}&key=${YT_API_KEY}`
    );
    return response.json();
}