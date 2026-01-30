# TaskFighter! ⚔️

A high-fidelity, interactive Todo application built with **RedwoodSDK**, **Kysely**, and **Tailwind CSS v4**.

This project serves as a comprehensive example for the RedwoodSDK community playground, demonstrating modern edge-native patterns and React 19 features.

## ✨ Key Features

- **Inline Task Editing**: Click any task text to instantly transform it into an input field.
- **Optimistic UI Updates**: Powered by React 19's `useOptimistic` hook for zero-latency interactions and clear "SAVING..." indicators.
- **Modern Aesthetic**: A premium UI featuring glassmorphism, smooth animations, and a responsive design built on Tailwind CSS v4.
- **Edge-Native Persistence**: Type-safe SQLite interactions using Kysely over RedwoodSDK's Durable Object DB.

## 🛠 Tech Stack

- **Framework**: [RedwoodSDK](https://docs.rwsdk.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Database**: [Kysely](https://kysely.dev/) (SQLite)
- **Infrastructure**: Cloudflare Workers & Durable Objects

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Locally
```bash
npm run dev
```

Your app will be available at `http://localhost:5173/`.

## 📖 Pattern Highlights

### `useOptimistic` Implementation
The app demonstrates the latest React 19 patterns to manage async state without manual synchronization boilerplate:
```tsx
const [optimisticTodo, addOptimisticTodo] = useOptimistic(todo, (state, update) => ({
  ...state,
  ...update,
  sending: true
}));
```

### Server Components & Actions
- **`src/app/pages/queries.ts`**: Uses `serverQuery` for initial data fetching.
- **`src/app/pages/actions.ts`**: Uses `serverAction` for all mutations (Create, Update, Delete, Clear).

---
*Built for the RedwoodSDK Community Playground.*