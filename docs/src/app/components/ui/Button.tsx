import clsx from "clsx";
import type { ComponentProps } from "react";

const variants = {
  ghost:
    "inline-flex items-center justify-center rounded-md p-1.5 text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground",
  secondary:
    "inline-flex w-fit items-center justify-center rounded-md p-2 font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent hover:text-fd-accent-foreground px-2 py-1.5 text-xs gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground cursor-pointer",
} as const;

export function buttonVariants(variant: keyof typeof variants): string {
  return variants[variant];
}

export function Button({
  variant,
  className,
  ...props
}: { variant: keyof typeof variants } & ComponentProps<"button">) {
  return (
    <button className={clsx(variants[variant], className)} {...props} />
  );
}
