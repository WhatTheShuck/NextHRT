import { Node, mergeAttributes } from "@tiptap/core";

/**
 * An inline, atomic node that stands in for a `{token}` while editing.
 *
 * Templates are stored as HTML with literal `{token}` text, which is fragile to
 * edit: a stray keystroke inside the braces silently turns a working token into
 * text that mails out as `{preferredFirstNam}`. Representing each one as an atom
 * makes it a single indivisible object — it deletes in one press and cannot be
 * typed into halfway.
 *
 * The conversion is a boundary concern: `tokensToPills` on the way into the
 * editor, `pillsToTokens` on the way out. Nothing downstream ever sees the span.
 */
export const TokenNode = Node.create({
  name: "token",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-token") ?? "",
        renderHTML: (attributes) => ({ "data-token": attributes.name }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-token]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "email-token" }),
      `{${node.attrs.name}}`,
    ];
  },

  renderText({ node }) {
    return `{${node.attrs.name}}`;
  },
});

// A bare {token}. Deliberately excludes {#token} / {/token} conditional markers:
// those are structural, only appear in fragment templates, and are edited as
// source rather than as pills.
const TOKEN_TEXT = /\{(\w+)\}/g;

const TOKEN_SPAN = /<span[^>]*data-token="(\w+)"[^>]*>.*?<\/span>/g;

/**
 * Turn `{token}` text into pill spans, ready for the editor to parse.
 *
 * Only text between tags is rewritten. Tokens do appear inside attributes —
 * `<a href="{summaryUrl}">` is a real template — and those must stay literal
 * text, since an attribute value cannot hold an element.
 */
export function tokensToPills(html: string): string {
  return html
    .split(/(<[^>]*>)/)
    .map((part) =>
      part.startsWith("<")
        ? part
        : part.replace(TOKEN_TEXT, (_m, name) => `<span data-token="${name}"></span>`),
    )
    .join("");
}

/** Turn pill spans back into the `{token}` text that gets stored and sent. */
export function pillsToTokens(html: string): string {
  return html.replace(TOKEN_SPAN, (_m, name) => `{${name}}`);
}

// Markup outside what the rich-text editor models. Round-tripping a template
// containing any of it through the WYSIWYG would quietly discard it, so the
// editor warns and keeps the author in HTML mode instead.
const UNSUPPORTED_MARKUP = [
  { pattern: /<table[\s>]/i, label: "tables" },
  { pattern: /<div[\s>]/i, label: "<div> blocks" },
  { pattern: /<style[\s>]/i, label: "<style> blocks" },
  { pattern: /\sstyle="/i, label: "inline styles" },
  { pattern: /<img[\s>]/i, label: "images" },
  { pattern: /<span(?![^>]*data-token)[\s>]/i, label: "<span> wrappers" },
];

/**
 * Names the constructs in `html` that rich-text editing cannot represent, so the
 * caller can warn before offering the WYSIWYG. Empty means safe to round-trip.
 */
export function unsupportedMarkup(html: string): string[] {
  return UNSUPPORTED_MARKUP.filter((m) => m.pattern.test(html)).map(
    (m) => m.label,
  );
}
