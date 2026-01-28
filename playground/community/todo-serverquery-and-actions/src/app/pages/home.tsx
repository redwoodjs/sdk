import { Todo } from "../components/Todo";
import { createTodo, clearTodos } from "./actions";
import { getTodos } from "./queries";

export const Home = async () => {
  const todos = await getTodos();

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
          <form action={createTodo} className="mb-8">
            <div className="flex flex-col gap-3">
              <input
                type="text"
                name="text"
                placeholder="What needs to be done?"
                className="w-full px-5 py-3 rounded-2xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400"
              />
              <button
                type="submit"
                className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
              >
                Add Task
              </button>
            </div>
          </form>

          <div className="space-y-1">
            {todos.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-slate-400 italic">No tasks yet. Enjoy your day! ☀️</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100/50">
                {todos.map((todo) => (
                  <Todo key={todo.id} todo={todo} />
                ))}
              </ul>
            )}
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
