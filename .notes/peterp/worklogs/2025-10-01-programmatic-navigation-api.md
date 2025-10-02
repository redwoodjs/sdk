# Programmatic Navigation API

## Problem

The existing client-side navigation is driven by user interactions with anchor tags and browser history events (back/forward buttons). There is no public API to trigger navigation programmatically from JavaScript. This is a common requirement for web applications, for instance, when redirecting a user after a form submission or a successful login.

## Context

The goal is to introduce a `navigate` function that can be used by developers. The API design should align with the emerging web standard `Navigation.navigate()` to provide a familiar and future-proof interface.

- [GitHub Issue #768](https://github.com/redwoodjs/sdk/issues/768)
- [MDN: `Navigation.navigate()`](https://developer.mozilla.org/en-US/docs/Web/API/Navigation/navigate)

## Plan

1.  **Update Architecture:** Modify `docs/architecture/clientSideNavigation.md` to document the new programmatic navigation API.
2.  **Implementation:**
    -   Refactor the existing navigation logic in `initClientNavigation` to be reusable.
    -   Expose a `navigate` function from `initClientNavigation`.
    -   Implement the `navigate` function to handle URL changes, history updates (`push` and `replace`), and server communication for RSC updates.
3.  **Testing:** Add end-to-end tests to verify the functionality of the `navigate` function in a playground application.

