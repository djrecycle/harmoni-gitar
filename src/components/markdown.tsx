import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Render lesson Markdown safely (raw HTML is not processed). Links open in a new tab. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-lesson", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          // A wide table scrolls sideways on its own instead of stretching the page on phones.
          table: ({ children }) => (
            <div className="overflow-x-auto [contain:inline-size]">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

const INLINE = ["p", "strong", "em", "del", "code"];

/**
 * One line of Markdown inside other text (a quiz question, an answer button): only **bold**, *italic*, ~~strike~~ and
 * `code` are kept; anything block-level (lists, headings) is unwrapped to its text.
 */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} allowedElements={INLINE} unwrapDisallowed components={{ p: ({ children }) => <>{children}</> }}>
      {children}
    </ReactMarkdown>
  );
}
