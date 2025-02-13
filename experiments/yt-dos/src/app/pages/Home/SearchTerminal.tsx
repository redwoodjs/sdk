"use client";

import { useState, useEffect, useRef, use } from "react";
import { fetchYoutubeVideos } from "./serverFunctions";
import { RouteContext } from "@redwoodjs/reloaded/router";

interface VideoItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
  };
}

export function SearchTerminal({ ctx }: { ctx: RouteContext }) {
  const [query, setQuery] = useState("");
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [blink, setBlink] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingChar, setLoadingChar] = useState('|');
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);

  const searchResults = searchTerm ? use(fetchYoutubeVideos(searchTerm, ctx)) : null;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      interval = setInterval(() => {
        setLoadingChar(prev => {
          switch(prev) {
            case '|': return '/';
            case '/': return '-';
            case '-': return '\\';
            default: return '|';
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
    if (cursorRef.current && inputRef.current) {
      cursorRef.current.style.left = `${inputRef.current.scrollWidth + 4}px`;
    }
  }, [query]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedVideo) {
        setSelectedVideo(null);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedVideo]);

  const handleSearch = async () => {
    if (!query) return;

    if (query.toLowerCase() === "dir") {
      setError(null);
      setVideos([]);
      setQuery("Directory listing not supported in YT-DOS");
      return;
    }

    if (query.toLowerCase() === "help") {
      setError(null);
      setVideos([]);
      setQuery("Available commands: SEARCH <query>, DIR, HELP, EXIT");
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
    setQuery("");
    setVideos([]);
    
    try {
      const data = await fetchYoutubeVideos(query, ctx);
      setVideos(data.items || []);
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError("A fatal exception has occurred at YT-DOS. System halted.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (searchResults) {
      setVideos(searchResults.items || []);
    }
  }, [searchResults]);

  return (
    <div className="flex flex-col min-h-screen font-mono bg-[#282a36] text-[#f8f8f2]">
      <div className="flex-grow p-6">
        {error ? (
          <pre className="text-[#ff5555] bg-[#44475a] p-4">
            {`A fatal exception has occurred at YT-DOS.
            System halted.
            Press any key to restart...`}
          </pre>
        ) : (
          <>
            <pre className="text-[#bd93f9] text-lg">
              {`
YT-DOS v1.0 - The Minimalist YouTube Experience
              `}
            </pre>
            <div className="w-full max-w-2xl">
              <div className="flex items-center relative w-full">
                <span className="text-lg text-[#50fa7b]">C:\YT-DOS\SEARCH&gt;</span>
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch();
                      if (!selectedVideo && e.key.match(/^[0-9]$/)) {
                        const index = parseInt(e.key, 10) - 1;
                        if (videos[index]) setSelectedVideo(videos[index].id.videoId);
                      }
                    }}
                    className="ml-2 w-full bg-[#282a36] text-[#f8f8f2] border-none outline-none caret-transparent focus:ring-0"
                  />
                  <span
                    className={`absolute top-0 text-[#f8f8f2] ${blink ? "inline" : "invisible"}`}
                    style={{ left: `${query.length * 10}px` }}
                  >_</span>
                </div>
              </div>
            </div>
            <div className="mt-4 w-full max-w-2xl">
              {isLoading ? (
                <pre className="text-[#f1fa8c]">
                  Searching{loadingChar}
                </pre>
              ) : selectedVideo ? (
                <div>
                  <iframe
                    width="100%"
                    height="400"
                    src={`https://www.youtube.com/embed/${selectedVideo}?rel=0`}
                    frameBorder="0"
                    allowFullScreen
                    className="border border-green-400"
                  ></iframe>
                  <p className="cursor-pointer mt-2 text-green-300" onClick={() => setSelectedVideo(null)}>
                    [X] Close Video
                  </p>
                </div>
              ) : (
                <pre className="mt-2 w-full max-w-2xl text-[#f8f8f2]">
                  {videos.map((video, index) => (
                    <div
                      key={video.id.videoId}
                      className="cursor-pointer hover:text-[#bd93f9]"
                      onClick={() => setSelectedVideo(video.id.videoId)}
                    >
                      [{index + 1}] {video.snippet.title}  <br/>
                      <span className="text-[#6272a4]">
                        &nbsp;&nbsp;&nbsp;&nbsp;by {video.snippet.channelTitle}
                      </span>
                    </div>
                  ))}
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
          [BUILT WITH REDWOODJS]
        </a>
      </footer>
    </div>
  );
}
