'use client'

import { startTransition, useState, useRef, useEffect, useOptimistic } from "react"
import { updateTodo, deleteTodo, editTodo } from "../pages/actions"
import type { Todo as TodoType } from "@/db"

type OptimisticTodo = TodoType & { sending?: boolean };

export function Todo({ todo }: { todo: TodoType }) {
    const [isEditing, setIsEditing] = useState(false)
    const [editText, setEditText] = useState(todo.text)
    const inputRef = useRef<HTMLInputElement>(null)

    const [optimisticTodo, addOptimisticTodo] = useOptimistic<OptimisticTodo, Partial<OptimisticTodo>>(
        todo,
        (state, newPartialTodo) => ({
            ...state,
            ...newPartialTodo,
            sending: true
        })
    )


    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus()
            inputRef.current.select()
        }
    }, [isEditing])

    const handleEditSave = () => {
        if (editText.trim() === "") {
            setEditText(optimisticTodo.text)
            setIsEditing(false)
            return
        }
        if (editText !== optimisticTodo.text) {
            startTransition(async () => {
                addOptimisticTodo({ text: editText })
                await editTodo(todo.id, editText)
            })
        }
        setIsEditing(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleEditSave()
        } else if (e.key === 'Escape') {
            setEditText(optimisticTodo.text)
            setIsEditing(false)
        }
    }

    return (
        <li className={`flex items-center justify-between py-4 group animate-in fade-in slide-in-from-bottom-2 duration-300 ${optimisticTodo.sending ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-4 flex-1">
                <div className="relative flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={optimisticTodo.completed === 1}
                        onChange={(e) => {
                            const newCompleted = e.target.checked ? 1 : 0
                            startTransition(async () => {
                                addOptimisticTodo({ completed: newCompleted })
                                await updateTodo(todo.id, newCompleted)
                            })
                        }}
                        className="w-5 h-5 rounded-lg border-slate-200 text-indigo-600 focus:ring-indigo-500/20 transition-all cursor-pointer peer appearance-none border-2 checked:border-indigo-600 checked:bg-indigo-600"
                    />
                    <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                </div>

                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={handleEditSave}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-slate-700 font-medium p-0"
                    />
                ) : (
                    <div className="flex flex-col">
                        <span
                            onClick={() => setIsEditing(true)}
                            className={`text-slate-700 font-medium transition-all duration-300 cursor-text select-none ${optimisticTodo.completed === 1 ? 'line-through text-slate-300' : ''}`}
                        >
                            {optimisticTodo.text}
                        </span>
                        {optimisticTodo.sending && (
                            <span className="text-[10px] text-indigo-400 font-bold animate-pulse">SAVING...</span>
                        )}
                    </div>
                )}
            </div>
            <button
                onClick={() => deleteTodo(optimisticTodo.id)}
                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-30"
                title="Delete task"
                disabled={optimisticTodo.sending}
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </li>
    )
}
