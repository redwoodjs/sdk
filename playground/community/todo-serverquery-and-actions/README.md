# PR: Premium Todo App Example (TaskFighter!)

This is a high-fidelity, interactive Todo application example for the RedwoodSDK community playground. It demonstrates best practices for using `serverQuery`, `serverAction`, and React 19's `useActionState` in a RedwoodSDK environment.

## Key Features

- **Interactive Inline Editing**: Click on any task to instantly transform it into an input field. Supports saving on Enter/Blur and cancelling on Escape.
- **Real-time Optimistic-like Updates**: leveraged React 19's `useActionState` to ensure UI synchronization with server actions.
- **Premium UI Redesign**: 
    - Full **Tailwind CSS v4** integration.
    - Glassmorphism effects with `backdrop-blur` and modern gradients.
    - Custom animated checkboxes and interactive hover states.
    - "TaskFighter!" branding and refined typography.
- **Robust Database Logic**:
    - Powered by **Kysely** for type-safe SQLite queries.
    - Utilizes **RedwoodSDK's Durable Object DB** for persistent storage and low-latency data retrieval on the edge.
    - Handled common pitfalls like table qualification and selection syntax in server actions.

## Technical Implementation Details

### 1. Server Actions & Queries
- `getTodos`: A `serverQuery` that fetches the current state of the database.
- `createTodo`, `updateTodo`, `editTodo`, `deleteTodo`, `clearTodos`: `serverAction` functions that handle state transitions with clean Kysely syntax.

### 2. React 19 Patterns
- Utilizes `useActionState` to manage server-side mutations while keeping the client UI in sync without manual state management for every toggle.
- Effective use of `startTransition` to ensure smooth UI updates during asynchronous actions.

### 3. Tailwind CSS v4 Setup
- Configured via `@tailwindcss/vite` plugin.
- Directives imported in [styles.css](cci:7://file:///Users/hermanstander/apps/redwood/sdk/playground/community/todo-serverquery-and-actions/src/app/styles.css:0:0-0:0) and linked dynamically in [document.tsx](cci:7://file:///Users/hermanstander/apps/redwood/sdk/playground/community/todo-serverquery-and-actions/src/app/document.tsx:0:0-0:0).

## How to use
1. Clone the repository.
2. Run `npm install`.
3. Run `npm run dev`.
4. Start fighting your tasks! ⚔️

---
*Created with ❤️ for the RedwoodSDK Community.*