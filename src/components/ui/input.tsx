import * as React from "react";
import { cn } from "@/lib/utils";
import { WOBBLY_RADIUS_SM } from "@/lib/utils";

/*
  Hand-Drawn inputs:
  - White background (not secondary gray — cleaner on warm paper)
  - 2px pencil-black border (full box, never underline-only)
  - Wobbly organic border-radius via inline style
  - Focus: border turns blue ballpoint, soft blue ring
  - Patrick Hand font for authentic handwritten feel
*/

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full border-2 border-foreground bg-white px-4 py-2.5",
          "font-sans text-base text-foreground",
          "placeholder:text-foreground/35",
          "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "transition-colors duration-100",
          className
        )}
        style={{ borderRadius: WOBBLY_RADIUS_SM, ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
