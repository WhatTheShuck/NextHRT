import { describe, it, expect } from "vitest";
import {
  LIST_TOKENS,
  TEMPLATE_META,
  TOKEN_DESCRIPTIONS,
  escapeHtml,
  referencedTokens,
  tokensFor,
  unbalancedConditionals,
  unknownTokens,
} from "@/lib/email-templates/tokens";
import { TEMPLATE_DEFAULTS } from "@/lib/email-templates/defaults";

describe("registry integrity", () => {
  it("has metadata for every seeded template", () => {
    const missing = TEMPLATE_DEFAULTS.filter(
      (t) => TEMPLATE_META[t.key] === undefined,
    ).map((t) => t.key);
    expect(missing).toEqual([]);
  });

  it("seeds every template the registry describes", () => {
    const seeded = new Set(TEMPLATE_DEFAULTS.map((t) => t.key));
    const missing = Object.keys(TEMPLATE_META).filter((k) => !seeded.has(k));
    expect(missing).toEqual([]);
  });

  it("describes every token it offers, so no chip is left unexplained", () => {
    const undescribed = [
      ...new Set(Object.values(TEMPLATE_META).flatMap((m) => [...m.tokens])),
    ].filter((t) => TOKEN_DESCRIPTIONS[t] === undefined);
    expect(undescribed).toEqual([]);
  });

  it("points every list token at a row fragment that exists", () => {
    for (const [parent, source] of Object.entries(LIST_TOKENS)) {
      expect(TEMPLATE_META[source.rowKey]?.kind).toBe("fragment");
      // The parent must actually offer the token the list fills.
      expect(tokensFor(parent)).toContain(source.token);
      expect(source.wrapper).toContain("{rows}");
    }
  });

  it("only uses tokens its own send site supplies in the default copy", () => {
    // Catches a default that references a token the fan-out never passes — it
    // would mail out as literal "{token}" text on a fresh database.
    const offenders = TEMPLATE_DEFAULTS.flatMap((t) => {
      const bad = [
        ...new Set([
          ...unknownTokens(t.key, t.subject),
          ...unknownTokens(t.key, t.body),
        ]),
      ];
      return bad.length > 0 ? [`${t.key}: ${bad.join(", ")}`] : [];
    });
    expect(offenders).toEqual([]);
  });

  it("balances every conditional block in the default copy", () => {
    const offenders = TEMPLATE_DEFAULTS.flatMap((t) =>
      unbalancedConditionals(t.body).length > 0 ? [t.key] : [],
    );
    expect(offenders).toEqual([]);
  });

  it("keeps {content} in the default layout", () => {
    const layout = TEMPLATE_DEFAULTS.find((t) => t.key === "email.layout");
    expect(layout?.body).toContain("{content}");
  });
});

describe("referencedTokens", () => {
  it("finds plain tokens and conditional markers", () => {
    expect(referencedTokens("{a} {#b}x{/b} {a}")).toEqual(["a", "b"]);
  });
});

describe("unknownTokens", () => {
  it("flags a misspelled token", () => {
    expect(unknownTokens("sop.passed", "Hi {employeeNam}")).toEqual([
      "employeeNam",
    ]);
  });

  it("accepts a token the template does supply", () => {
    expect(unknownTokens("sop.passed", "Hi {employeeName}")).toEqual([]);
  });

  it("flags a token that is valid elsewhere but not here", () => {
    // The whole point of a per-key registry: {ticketList} is real, just not
    // available to an SOP email.
    expect(unknownTokens("sop.passed", "{ticketList}")).toEqual(["ticketList"]);
  });
});

describe("unbalancedConditionals", () => {
  it("passes a matched pair", () => {
    expect(unbalancedConditionals("{#a}x{/a}")).toEqual([]);
  });

  it("reports an unclosed block", () => {
    expect(unbalancedConditionals("{#a}x")).toEqual(["a"]);
  });

  it("reports a stray closing marker", () => {
    expect(unbalancedConditionals("x{/a}")).toEqual(["a"]);
  });

  it("reports crossed blocks", () => {
    expect(unbalancedConditionals("{#a}{#b}x{/a}{/b}")).toContain("a");
  });
});

describe("escapeHtml", () => {
  it("neutralises markup in a value destined for a template", () => {
    expect(escapeHtml('<b>&"')).toBe("&lt;b&gt;&amp;&quot;");
  });
});
