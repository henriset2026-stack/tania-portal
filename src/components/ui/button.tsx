import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "default" | "primary" | "destructive" | "ghost";
type Size = "sm" | "md";

const variants: Record<Variant, string> = {
  default: "border border-border bg-white text-foreground hover:bg-muted",
  primary: "border border-primary bg-primary text-primary-foreground hover:opacity-90",
  destructive: "border border-destructive bg-destructive text-white hover:opacity-90",
  ghost: "border border-transparent text-muted-foreground hover:bg-muted",
};
const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[12.5px]",
  md: "h-[34px] px-3.5 text-[13px]",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium",
        "transition-colors disabled:pointer-events-none disabled:opacity-50",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
