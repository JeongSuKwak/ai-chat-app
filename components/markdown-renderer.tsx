"use client";

import { useState, useCallback, memo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  language: string;
  value: string;
}

const CodeBlock = memo(function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [value]);

  return (
    <div className="relative group my-4">
      {/* Language badge & Copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 rounded-t-lg">
        <span className="text-xs text-zinc-400 font-mono uppercase">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-700/50 hover:bg-zinc-700 rounded transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code content */}
      <SyntaxHighlighter
        style={oneDark}
        language={language || "text"}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0 0 0.5rem 0.5rem",
          padding: "1rem",
          fontSize: "0.875rem",
        }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
});

interface InlineCodeProps {
  children: React.ReactNode;
}

const InlineCode = memo(function InlineCode({ children }: InlineCodeProps) {
  return (
    <code className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-pink-600 dark:text-pink-400 rounded text-sm font-mono">
      {children}
    </code>
  );
});

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
}: MarkdownRendererProps) {
  const components: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const isInline = !match && !className;

      if (isInline) {
        return <InlineCode>{children}</InlineCode>;
      }

      return (
        <CodeBlock
          language={match ? match[1] : ""}
          value={String(children).replace(/\n$/, "")}
        />
      );
    },
    // Heading styles
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold mt-6 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-700">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold mt-5 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold mt-4 mb-2">{children}</h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold mt-3 mb-2">{children}</h4>
    ),
    // Paragraph
    p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
    // Lists
    ul: ({ children }) => (
      <ul className="my-3 ml-6 list-disc space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-3 ml-6 list-decimal space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-7">{children}</li>,
    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 hover:text-blue-600 underline underline-offset-2"
      >
        {children}
      </a>
    ),
    // Blockquote
    blockquote: ({ children }) => (
      <blockquote className="my-4 pl-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/30 py-2 italic text-gray-700 dark:text-gray-300">
        {children}
      </blockquote>
    ),
    // Horizontal rule
    hr: () => <hr className="my-6 border-zinc-200 dark:border-zinc-700" />,
    // Tables
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto">
        <table className="min-w-full border-collapse border border-zinc-200 dark:border-zinc-700">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-zinc-100 dark:bg-zinc-800">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border border-zinc-200 dark:border-zinc-700">
        {children}
      </td>
    ),
    // Strong and em
    strong: ({ children }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }) => <em className="italic">{children}</em>,
    // Images
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || ""}
        className="my-4 max-w-full h-auto rounded-lg"
      />
    ),
  };

  return (
    <div
      className={`markdown-content text-gray-900 dark:text-gray-100 ${
        isStreaming ? "streaming" : ""
      }`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});

