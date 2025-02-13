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
    <div className="flex flex-col min-h-screen font-mono bg-black text-green-400">
      <div className="flex-grow p-6">
        {error ? (
          <pre className="text-white bg-blue-900 p-4">
            {`A fatal exception has occurred at YT-DOS.
            System halted.
            Press any key to restart...`}
          </pre>
        ) : (
          <>
            <pre className="text-green-400 text-lg">
              {`

Y88b   d88P 88888888888      8888888b.   .d88888b.   .d8888b.  
Y88b d88P      888          888  "Y88b d88P" "Y88b d88P  Y88b 
 Y88o88P       888          888    888 888     888 Y88b.      
  Y888P        888          888    888 888     888  "Y888b.   
   888         888          888    888 888     888     "Y88b. 
   888         888   888888 888    888 888     888       "888 
   888         888          888  .d88P Y88b. .d88P Y88b  d88P 
   888         888          8888888P"   "Y88888P"   "Y8888P"  
                                                              

YT-DOS v1.0 - The Minimalist YouTube Experience
              `}
            </pre>
            <div className="w-full max-w-2xl">
              <div className="flex items-center relative w-full">
                <span className="text-lg">C:\YT-DOS\SEARCH&gt;</span>
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
                    className="ml-2 w-full bg-black text-green-400 border-none outline-none caret-transparent focus:ring-0"
                  />
                  {/* <span
                    ref={cursorRef}
                    className={`absolute top-0 text-green-400 ${blink ? "inline" : "invisible"}`}
                    style={{ left: `${query.length * 10}px` }}
                  >_</span> */}
                </div>
              </div>
            </div>
            <div className="mt-4 w-full max-w-2xl">
              {isLoading ? (
                <pre className="text-green-400">
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
                <pre className="mt-2 w-full max-w-2xl text-green-400">
                  {videos.map((video, index) => (
                    <div
                      key={video.id.videoId}
                      className="cursor-pointer"
                      onClick={() => setSelectedVideo(video.id.videoId)}
                    >
                      [{index + 1}] {video.snippet.title}  <br/>
                      &nbsp;&nbsp;&nbsp;&nbsp;by {video.snippet.channelTitle}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
      <footer className="p-4 border-t border-green-400 text-center">
        <a 
          href="https://redwoodjs.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-green-300"
        >
          [BUILT WITH REDWOODJS]
        </a>
      </footer>
    </div>
  );
}
