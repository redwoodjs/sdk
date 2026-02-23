import clsx from "clsx";

const variantClasses: Record<string, string> = {
  default: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
  note: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
  tip: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
  caution:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
};

export function Badge({
  text,
  variant = "default",
}: {
  text: string;
  variant?: "note" | "tip" | "caution" | "danger" | "default";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantClasses[variant] ?? variantClasses.default,
      )}
    >
      {text}
    </span>
  );
}
