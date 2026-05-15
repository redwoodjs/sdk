import { Suspense } from "react";
import { TodoListFetch } from "../components/TodoListFetch";
import { TodoListSkeleton } from "../components/TodoListSkeleton";
import { AddTodoForm } from "../components/AddTodoForm";
import { clearTodos } from "./actions";

export const Home = async () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            TaskFighter!
          </h1>
          <p className="text-slate-500 font-medium">
            Fight your daily tasks with elegance.
          </p>
        </header>

        <main className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-100 border border-white p-8">
          <AddTodoForm />

          <div className="space-y-1">
            <Suspense fallback={<TodoListSkeleton />}>
              <TodoListFetch />
            </Suspense>
          </div>

          <footer className="mt-10 pt-6 border-t border-slate-100 flex justify-center">
            <form action={clearTodos}>
              <button
                type="submit"
                className="text-slate-400 hover:text-red-500 text-sm font-semibold transition-colors flex items-center gap-2 group"
              >
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">🗑️</span>
                Clear all tasks
              </button>
            </form>
          </footer>
        </main>

        <section className="mt-12 text-center text-slate-400 text-xs">
          Built with <a href="https://rwsdk.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-500">RedwoodSDK</a>
        </section>
      </div>
    </div>
  )
};
