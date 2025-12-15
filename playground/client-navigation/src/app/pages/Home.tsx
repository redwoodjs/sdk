"use client";

import { navigate } from "rwsdk/client";
import type { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  return (
    <div>
      {/* Demonstrate navigation preloading: render a preload link for the
          /about route. With React 19, this <link> will be hoisted into
          <head>, and our client navigation code will warm the RSC navigation
          response for /about using the Cache API. */}
      <link rel="preload" href="/about" />

      <h1>Hello World</h1>
      <button
        id="navigate-to-about"
        onClick={() => {
          navigate("/about");
        }}
      >
        Go to About Page
      </button>

      <button
        id="navigate-with-smooth-scroll"
        onClick={() => {
          navigate("/about", {
            info: {
              scrollBehavior: "smooth",
            },
          });
        }}
      >
        Go to About Page with Smooth Scroll
      </button>

      <a href="/about" id="about-link">
        Go to About Page with Link
      </a>
    </div>
  );
}
