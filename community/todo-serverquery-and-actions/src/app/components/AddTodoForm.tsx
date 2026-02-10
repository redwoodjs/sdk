'use client'

import { useActionState, useRef, useEffect } from "react"
import { createTodo } from "../pages/actions"

export function AddTodoForm() {
    const formRef = useRef<HTMLFormElement>(null)
    const [state, action, isPending] = useActionState(async (prevState: any, formData: FormData) => {
        await createTodo(formData)
        return null
    }, null)

    useEffect(() => {
        if (!isPending) {
            formRef.current?.reset()
        }
    }, [isPending])

    return (
        <form ref={formRef} action={action} className="mb-8">
            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    name="text"
                    required
                    placeholder="What needs to be done?"
                    className="w-full px-5 py-3 rounded-2xl border border-slate-200 bg-white/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-slate-400 disabled:opacity-50"
                    disabled={isPending}
                />
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    {isPending ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding Task...
                        </>
                    ) : (
                        'Add Task'
                    )}
                </button>
            </div>
        </form>
    )
}
