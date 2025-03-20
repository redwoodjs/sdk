"use client";

import { useState, useEffect, useRef } from "react";

interface VideoItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
  };
}

interface YouTubeResponse {
  items: VideoItem[];
  nextPageToken?: string;
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [blink, setBlink] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingChar, setLoadingChar] = useState("|");
  const [currentSearch, setCurrentSearch] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<VideoItem[]>(() => {
    // Load favorites from sessionStorage on initial render
    if (typeof window !== "undefined") {
      const savedFavorites = sessionStorage.getItem("yt-dos-favorites");
      return savedFavorites ? JSON.parse(savedFavorites) : [];
    }
    return [];
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  // Save favorites to sessionStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("yt-dos-favorites", JSON.stringify(favorites));
    }
  }, [favorites]);

  const toggleFavorite = (video: VideoItem) => {
    if (favorites.some((f) => f.id.videoId === video.id.videoId)) {
      // Remove from favorites
      setFavorites(favorites.filter((f) => f.id.videoId !== video.id.videoId));
    } else {
      // Add to favorites
      setFavorites([...favorites, video]);
    }
    // Refocus the input field
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleSearch = async (isMore: boolean = false) => {
    if (!query && !isMore) return;

    if (query.toLowerCase() === "dir") {
      setError(null);
      setVideos([]);
      setQuery("Directory listing not supported in YT-DOS");
      return;
    }

    if (query.toLowerCase() === "help") {
      setError(null);
      setVideos([]);
      setQuery("");

      // Create a DOS-style help screen as fake video results
      setVideos([
        {
          id: { videoId: "help-title" },
          snippet: {
            title: "YT-DOS Help System v1.0",
            channelTitle: "=======================",
          },
        },
        {
          id: { videoId: "help-commands" },
          snippet: {
            title: "Available Commands:",
            channelTitle: "------------------",
          },
        },
        {
          id: { videoId: "help-search" },
          snippet: {
            title: "SEARCH <query> - Search YouTube for videos",
            channelTitle: "Type your search and press ENTER",
          },
        },
        {
          id: { videoId: "help-more" },
          snippet: {
            title: "MORE - Load more search results",
            channelTitle: "Shows the next page of results for your last search",
          },
        },
        {
          id: { videoId: "help-fav" },
          snippet: {
            title: "FAV - Show your favorite videos",
            channelTitle: "Displays all videos you've marked with [*]",
          },
        },
        {
          id: { videoId: "help-dir" },
          snippet: {
            title: "DIR - List directory (not supported)",
            channelTitle: "YT-DOS is not a real file system",
          },
        },
        {
          id: { videoId: "help-help" },
          snippet: {
            title: "HELP - Display this help information",
            channelTitle: "Shows available commands and shortcuts",
          },
        },
        {
          id: { videoId: "help-exit" },
          snippet: {
            title: "EXIT - Exit YT-DOS",
            channelTitle: "Closes the current session",
          },
        },
        {
          id: { videoId: "help-shortcuts" },
          snippet: {
            title: "Keyboard Shortcuts:",
            channelTitle: "------------------",
          },
        },
        {
          id: { videoId: "help-numbers" },
          snippet: {
            title: "[1-9] - Press number keys to play videos from results",
            channelTitle: "Quick shortcut to play videos without clicking",
          },
        },
        {
          id: { videoId: "help-esc" },
          snippet: {
            title: "ESC - Close currently playing video",
            channelTitle: "Returns to the search results",
          },
        },
        {
          id: { videoId: "help-favorites" },
          snippet: {
            title: "Favorites:",
            channelTitle: "------------------",
          },
        },
        {
          id: { videoId: "help-fav1" },
          snippet: {
            title: "Click [*] next to any video to add/remove from favorites",
            channelTitle: "Yellow * indicates a favorited video",
          },
        },
        {
          id: { videoId: "help-fav2" },
          snippet: {
            title: "Type FAV to view all your favorites",
            channelTitle: "Your favorites are saved between sessions",
          },
        },
      ]);
      return;
    }

    if (query.toLowerCase() === "more") {
      if (currentSearch && nextPageToken) {
        setQuery("");
        const moreSearch = async () => {
          setIsLoading(true);
          try {
            const response = await fetch("/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              credentials: "same-origin",
              body: JSON.stringify({
                searchTerm: currentSearch,
                pageToken: nextPageToken,
              }),
            });

            if (!response.ok) {
              throw new Error("Search request failed");
            }

            const data = (await response.json()) as YouTubeResponse;
            setNextPageToken(data.nextPageToken || null);
            setVideos(data.items);
          } catch (error) {
            console.error("Error fetching more videos:", error);
            setError(
              "A fatal exception has occurred at YT-DOS. System halted.",
            );
          } finally {
            setIsLoading(false);
          }
        };
        moreSearch();
      } else {
        setQuery("No more videos to load or no active search");
      }
      return;
    }

    // Replace FAV and UNFAV commands with a single FAV command to show favorites
    if (query.toLowerCase() === "fav") {
      if (favorites.length === 0) {
        setError("No favorites saved. Click the [*] icon to add favorites.");
        setQuery("");
        return;
      }
      setVideos(favorites);
      setQuery("");
      return;
    }

    if (query.toLowerCase() === "exit") {
      setError(null);
      setQuery("Shutting down YT-DOS...");
      setTimeout(() => {
        setQuery("");
      }, 2000);
      return;
    }

    setIsLoading(true);
    if (!isMore) {
      setVideos([]);
      setCurrentSearch(query);
    }
    setQuery("");

    try {
      const response = await fetch("/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          searchTerm: isMore ? currentSearch : query,
          pageToken: isMore ? nextPageToken : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Search request failed");
      }

      const data = (await response.json()) as YouTubeResponse;
      setNextPageToken(data.nextPageToken || null);
      setVideos(isMore ? [...videos, ...data.items] : data.items);
    } catch (error) {
      console.error("Error fetching videos:", error);
      setError("A fatal exception has occurred at YT-DOS. System halted.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingChar((prev) => {
          switch (prev) {
            case "|":
              return "/";
            case "/":
              return "-";
            case "-":
              return "\\";
            default:
              return "|";
          }
        });
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      setBlink((prev) => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [query, selectedVideo]);

  useEffect(() => {
    const handleClick = () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedVideo) {
        setSelectedVideo(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedVideo]);

  return (
    <div className="flex flex-col min-h-screen font-mono bg-[#282a36] text-[#f8f8f2]">
      <div className="flex-grow p-6">
        {error ? (
          error.includes("YT-DOS Help System") ? (
            <pre className="text-[#f8f8f2] bg-[#44475a] p-4 overflow-auto">
              {error}
            </pre>
          ) : (
            <pre className="text-[#ff5555] bg-[#44475a] p-4">{error}</pre>
          )
        ) : (
          <>
            <pre className="text-[#bd93f9] text-lg">
              {`
YT-DOS v1.0 - The Minimalist YouTube Experience
              `}
            </pre>
            <div className="w-full">
              <div className="flex items-center relative w-full">
                <span className="text-lg text-[#50fa7b] whitespace-nowrap">
                  C:\YT-DOS\SEARCH&gt;
                </span>
                <div className="relative flex-1 w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                      if (!selectedVideo && e.key.match(/^[0-9]$/)) {
                        const index = parseInt(e.key, 10) - 1;
                        if (videos[index])
                          setSelectedVideo(videos[index].id.videoId);
                      }
                    }}
                    className="ml-2 w-full bg-[#282a36] text-[#f8f8f2] border-none outline-none caret-transparent focus:ring-0"
                  />
                  <span
                    ref={cursorRef}
                    className={`absolute top-0 text-[#f8f8f2] ${blink ? "inline" : "invisible"}`}
                    style={{ left: `${query.length * 10}px` }}
                  >
                    _
                  </span>
                </div>
              </div>

              {!selectedVideo && !isLoading && videos.length === 0 && (
                <div className="mt-4 text-[#6272a4]">
                  <pre>
                    {`
Type a search term and press ENTER to search YouTube.
Press [1-9] keys to play a video from the results (or click on the title).
Click [*] to add/remove favorites.
Type FAV to view your favorites.
Type HELP for more commands.
`}
                  </pre>
                </div>
              )}
            </div>
            <div className="max-w-3xl">
              {isLoading ? (
                <pre className="text-[#f1fa8c]">Searching{loadingChar}</pre>
              ) : selectedVideo ? (
                <div className="max-w-3xl mx-auto">
                  <iframe
                    width="100%"
                    height="400"
                    src={`https://www.youtube.com/embed/${selectedVideo}?rel=0&modestbranding=1&autoplay=1&controls=1&showinfo=0`}
                    frameBorder="0"
                    allowFullScreen
                    className="border border-green-400"
                  ></iframe>
                  <p
                    className="cursor-pointer mt-2 text-green-300"
                    onClick={() => setSelectedVideo(null)}
                  >
                    [X] Close Video
                  </p>
                </div>
              ) : (
                <pre className="mt-2 w-full text-[#f8f8f2]">
                  {videos.map((video, index) => {
                    const isFavorite = favorites.some(
                      (f) => f.id.videoId === video.id.videoId,
                    );
                    return (
                      <div key={video.id.videoId} className="mb-3">
                        <div
                          className="cursor-pointer hover:text-[#bd93f9]"
                          onClick={() => setSelectedVideo(video.id.videoId)}
                        >
                          [{index + 1}] {video.snippet.title}
                        </div>
                        <div className="flex items-center ml-8 text-[#6272a4]">
                          <span>by {video.snippet.channelTitle}</span>
                          <span
                            className="ml-3 cursor-pointer text-purple-500"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavorite(video);
                            }}
                          >
                            [
                            <span
                              className={
                                isFavorite
                                  ? "text-yellow-400"
                                  : "text-purple-500"
                              }
                            >
                              *
                            </span>
                            ]
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {nextPageToken && videos.length > 0 && (
                    <div className="mt-4 text-[#50fa7b]">
                      Type MORE to load more videos...
                    </div>
                  )}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="p-4 border-t border-[#44475a] text-center">
        <a
          href="https://redwoodjs.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8be9fd] hover:text-[#bd93f9]"
        >
          [BUILT WITH @redwoodjs/sdk]
        </a>
      </footer>
    </div>
  );
}
