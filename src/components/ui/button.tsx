import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { WOBBLY_RADIUS } from "@/lib/utils";

/*
  Hand-Drawn buttons:
  - Wobbly organic border-radius (inline style, cannot be Tailwind)
  - Thick 3px pencil border
  - Hard offset shadow (no blur) — cut-paper collage aesthetic
  - Hover: fills with accent color, shadow reduces → "pressing" effect
  - Active: shadow disappears, translates → fully "pressed flat"
*/

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "border-[3px] border-foreground font-sans text-base font-semibold",
    "ring-offset-background transition-all duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        /* White background → red on hover */
        default: [
          "bg-background text-foreground",
          "shadow-[4px_4px_0px_0px_#2d2d2d]",
          "hover:bg-primary hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]",
          "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        ].join(" "),
        /* Already-filled red — for danger / confirm actions */
        destructive: [
          "bg-primary text-white",
          "shadow-[4px_4px_0px_0px_#2d2d2d]",
          "hover:bg-primary/80 hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]",
          "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        ].join(" "),
        /* Outlined — secondary action, hovers to muted blue */
        outline: [
          "bg-background text-foreground",
          "shadow-[4px_4px_0px_0px_#2d2d2d]",
          "hover:bg-secondary hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]",
          "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        ].join(" "),
        /* Muted background → blue on hover */
        secondary: [
          "bg-secondary text-foreground",
          "shadow-[4px_4px_0px_0px_#2d2d2d]",
          "hover:bg-accent hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] hover:translate-x-[2px] hover:translate-y-[2px]",
          "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        ].join(" "),
        /* Ghost — minimal, no shadow, no border fill */
        ghost: "border-transparent bg-transparent text-foreground hover:bg-secondary hover:border-foreground/30",
        /* Link — just styled text */
        link: "border-transparent bg-transparent text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-12 px-6 py-2.5",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-8 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        style={{ borderRadius: WOBBLY_RADIUS, ...style }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
