import * as React from "react";
import { cn } from "@/lib/utils";

const PremiumCard = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "rounded-xl border border-border/50 bg-card/50 text-card-foreground shadow-sm backdrop-blur-xl transition-all hover:shadow-md hover:border-border/80",
            className
        )}
        {...props}
    />
));
PremiumCard.displayName = "PremiumCard";

const PremiumCardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1.5 p-6", className)}
        {...props}
    />
));
PremiumCardHeader.displayName = "PremiumCardHeader";

const PremiumCardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-2xl font-semibold leading-none tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent",
            className
        )}
        {...props}
    />
));
PremiumCardTitle.displayName = "PremiumCardTitle";

const PremiumCardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
));
PremiumCardDescription.displayName = "PremiumCardDescription";

const PremiumCardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
PremiumCardContent.displayName = "PremiumCardContent";

const PremiumCardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-6 pt-0", className)}
        {...props}
    />
));
PremiumCardFooter.displayName = "PremiumCardFooter";

export {
    PremiumCard,
    PremiumCardHeader,
    PremiumCardFooter,
    PremiumCardTitle,
    PremiumCardDescription,
    PremiumCardContent,
};
