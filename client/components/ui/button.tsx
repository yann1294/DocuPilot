import * as React from "react";
import { cn } from "@/lib/utils";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
        variant === "default" && "bg-sky-600 text-white hover:bg-sky-700",
        variant === "outline" && "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        className
      )}
      {...props}
    />
  );
}
