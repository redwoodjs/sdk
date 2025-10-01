---
title: Client-Side Navigation
description: An explanation of how client-side navigation works in RedwoodSDK, providing a Single Page App (SPA) like experience.
---

## Problem

In traditional web applications, every navigation to a new page triggers a full-page reload. This process can be slow and disruptive to the user experience, as the browser has to discard the current page, fetch the new HTML document, and re-render everything from scratch. This is particularly noticeable in modern, interactive applications where a seamless user experience is expected. Single Page Applications (SPAs) solve this by intercepting navigation and updating the page content dynamically, but often introduce complexity with client-side routing libraries and state management.

RedwoodSDK aims to provide the benefits of SPA-like navigation-no full page reloads-without the added complexity of a full-blown client-side routing framework. The goal is to enhance the user experience by making navigations faster and smoother, while keeping the programming model simple and familiar.

## Progressive Enhancement

A core tenet of RedwoodSDK is progressive enhancement. This means that features are built in layers, starting with a baseline that works for everyone, and then adding enhancements for more capable browsers.

Client-side navigation is a prime example of this principle. The baseline is a standard, multi-page application using HTML `<a>` tags. This works universally, even with JavaScript disabled. The client-side navigation feature is an enhancement layer. When JavaScript is enabled, `initClientNavigation` upgrades the user experience to that of a Single Page App, without changing the underlying semantics of the application. The application remains fully functional and accessible without this enhancement.

## Solution

RedwoodSDK's client-side navigation intercepts clicks on internal links and fetches page content asynchronously, updating the DOM without a full page reload. This is achieved through a function, `initClientNavigation`, which is called in the client-side entry point of the application.

### How it Works

1.  **Initialization**: The developer calls `initClientNavigation()` in their `src/client.tsx` file. This sets up a global click event listener on the `document`.

2.  **Event Interception**: When a user clicks anywhere on the page, the event listener checks if the click target is an `<a>` tag with an `href` attribute pointing to a same-origin URL. It also performs several checks to ensure it doesn't interfere with expected browser behaviors, such as ignoring clicks with modifier keys (e.g., `Cmd+click` to open in a new tab), links with a `target` attribute, or download links.

3.  **URL Update**: If the click is a candidate for client-side navigation, the default browser navigation is prevented. The new URL is then pushed to the browser's history using `window.history.pushState()`. This updates the URL in the address bar without triggering a page load.

4.  **Content Fetching**: After the URL is updated, a request is made to the server to fetch the React Server Component (RSC) payload for the new page.

5.  **DOM Update**: When the RSC payload is received, the client-side runtime hydrates the new content into the existing page, effectively replacing the old view with the new one.

6.  **Scroll Management**: By default, after the new content is rendered, the page is scrolled to the top, mimicking the behavior of a traditional page load. This behavior can be configured to use smooth scrolling or can be disabled entirely.

7.  **Back/Forward Navigation**: An event listener for the `popstate` event is also set up to handle browser back and forward button clicks. When a `popstate` event occurs, it triggers a fetch for the corresponding page's RSC payload.

This approach provides a faster, smoother navigation experience, characteristic of a SPA, while leveraging server-side rendering with RSCs for content. It avoids the need for a complex client-side router, allowing developers to use standard `<a>` tags for navigation.
