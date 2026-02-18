import clsx from "clsx";

const variantClasses: Record<string, string> = {
  default: "bg-zinc-700 text-zinc-200",
  note: "bg-blue-900/50 text-blue-300",
  tip: "bg-green-900/50 text-green-300",
  caution: "bg-yellow-900/50 text-yellow-300",
  danger: "bg-red-900/50 text-red-300",
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
