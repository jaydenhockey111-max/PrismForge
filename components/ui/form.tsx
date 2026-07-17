import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label suppressHydrationWarning className="grid gap-2 text-sm font-semibold text-ink">
      <span>{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-ink/55">{hint}</span>}
    </label>
  );
}

const inputStyle = "min-h-12 w-full rounded-2xl border border-ink/15 bg-white px-4 text-base text-ink outline-none transition placeholder:text-ink/35 focus:border-moss focus:ring-2 focus:ring-moss/15";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputStyle, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputStyle, className)} {...props}>{children}</select>;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputStyle, "min-h-32 py-3", className)} {...props} />;
}

export function FormMessage({ message, type = "error" }: { message?: string; type?: "error" | "success" }) {
  if (!message) return null;
  return <p role="status" className={cn("rounded-2xl px-4 py-3 text-sm", type === "error" ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800")}>{message}</p>;
}
