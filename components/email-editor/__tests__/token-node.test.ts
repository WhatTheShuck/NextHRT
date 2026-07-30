import { describe, it, expect } from "vitest";
import {
  pillsToTokens,
  tokensToPills,
  unsupportedMarkup,
} from "@/components/email-editor/token-node";

// The conversion sits between the stored template and the editor. A bug here
// corrupts template copy silently — the author sees something plausible and the
// damage only surfaces in a sent email — so it is checked directly.
describe("tokensToPills", () => {
  it("converts a token in text into a pill span", () => {
    expect(tokensToPills("<p>Hi {name}</p>")).toBe(
      '<p>Hi <span data-token="name"></span></p>',
    );
  });

  it("leaves a token inside an attribute alone", () => {
    // <a href="{summaryUrl}"> is a real template. An attribute value cannot hold
    // an element, so this one has to stay literal text.
    expect(tokensToPills('<a href="{summaryUrl}">link</a>')).toBe(
      '<a href="{summaryUrl}">link</a>',
    );
  });

  it("converts link text while leaving the same token in the href", () => {
    expect(tokensToPills('<a href="{summaryUrl}">{summaryUrl}</a>')).toBe(
      '<a href="{summaryUrl}"><span data-token="summaryUrl"></span></a>',
    );
  });

  it("leaves conditional markers as text", () => {
    // {#token} blocks are structural, not values, and are edited as source.
    expect(tokensToPills("{#url}x{/url}")).toBe("{#url}x{/url}");
  });

  it("ignores braces that are not tokens", () => {
    expect(tokensToPills("<p>{ not a token } {}</p>")).toBe(
      "<p>{ not a token } {}</p>",
    );
  });
});

describe("pillsToTokens", () => {
  it("converts a pill span back to token text", () => {
    expect(
      pillsToTokens('<p>Hi <span data-token="name" class="email-token">{name}</span></p>'),
    ).toBe("<p>Hi {name}</p>");
  });

  it("round-trips a template unchanged", () => {
    const original =
      '<p>Hi {managerName},</p><ul><li><a href="{summaryUrl}">{summaryUrl}</a></li></ul>';
    // Simulating what the editor emits: pills rendered with their text content.
    const inEditor = tokensToPills(original).replace(
      /<span data-token="(\w+)"><\/span>/g,
      (_m, name) => `<span data-token="${name}" class="email-token">{${name}}</span>`,
    );
    expect(pillsToTokens(inEditor)).toBe(original);
  });

  it("handles several pills in one line", () => {
    const html =
      '<p><span data-token="a" class="email-token">{a}</span> and <span data-token="b" class="email-token">{b}</span></p>';
    expect(pillsToTokens(html)).toBe("<p>{a} and {b}</p>");
  });
});

describe("unsupportedMarkup", () => {
  it("passes markup the rich-text editor models", () => {
    expect(
      unsupportedMarkup("<p>Hi <strong>there</strong></p><ul><li>a</li></ul>"),
    ).toEqual([]);
  });

  it("flags the layout's table markup", () => {
    expect(unsupportedMarkup('<table role="presentation"><tr></tr></table>')).toContain(
      "tables",
    );
  });

  it("flags inline styles", () => {
    expect(unsupportedMarkup('<p style="color:red">x</p>')).toContain(
      "inline styles",
    );
  });

  it("does not mistake a token pill for an unsupported span", () => {
    expect(unsupportedMarkup('<p><span data-token="a"></span></p>')).toEqual([]);
  });
});
