'use client'

export function TodoListSkeleton() {
    return (
        <div className="divide-y divide-slate-100/50">
            {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-4 animate-pulse">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-5 h-5 rounded-lg bg-slate-100 border-2 border-slate-200" />
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="h-4 bg-slate-100 rounded-md w-3/4" />
                            {i === 1 && <div className="h-2 bg-indigo-50 rounded-md w-1/4" />}
                        </div>
                    </div>
                    <div className="w-9 h-9 bg-slate-50 rounded-xl" />
                </div>
            ))}
        </div>
    )
}
