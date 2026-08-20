import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export const mdxComponents: MDXComponents = {
    h1: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h1
        className={cn(
          "mt-6 mb-2 text-xl font-semibold tracking-tight text-foreground md:text-2xl",
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h2
        className={cn(
          "mt-6 mb-2 text-lg font-semibold tracking-tight text-foreground md:text-xl",
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
      <h3
        className={cn(
          "mt-4 mb-1.5 text-base font-semibold tracking-tight text-foreground",
          className
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => (
      <p
        className={cn("mt-2 leading-7 text-foreground/90", className)}
        {...props}
      />
    ),
    a: ({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        className={cn(
          "font-medium text-primary underline-offset-4 hover:underline",
          className
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }: HTMLAttributes<HTMLUListElement>) => (
      <ul
        className={cn(
          "mt-2 ml-6 list-disc space-y-1 marker:text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    ol: ({ className, ...props }: HTMLAttributes<HTMLOListElement>) => (
      <ol
        className={cn(
          "mt-2 ml-6 list-decimal space-y-1 marker:text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    li: ({ className, ...props }: HTMLAttributes<HTMLLIElement>) => (
      <li className={cn("leading-7 text-foreground/90", className)} {...props} />
    ),
    strong: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
      <strong
        className={cn("font-semibold text-foreground", className)}
        {...props}
      />
    ),
    blockquote: ({ className, ...props }: HTMLAttributes<HTMLQuoteElement>) => (
      <blockquote
        className={cn(
          "my-4 border-l-2 border-border pl-4 italic text-muted-foreground",
          className
        )}
        {...props}
      />
    ),
    code: ({ className, ...props }: HTMLAttributes<HTMLElement>) => (
      <code
        className={cn(
          "rounded bg-muted px-[0.4rem] py-[0.2rem] font-mono text-sm text-foreground",
          className
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }: HTMLAttributes<HTMLHRElement>) => (
      <hr className={cn("my-8 border-border", className)} {...props} />
    ),
};
