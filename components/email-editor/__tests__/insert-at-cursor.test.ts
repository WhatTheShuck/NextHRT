import { beforeAll, describe, expect, it, vi } from "vitest";
import { insertAtCursor, wrapSelection } from "../insert-at-cursor";

// These helpers restore the caret on the next frame, after React has re-rendered
// with the new value. Running the callback immediately is enough for the tests:
// there is no React here, only the call to assert on.
beforeAll(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

/**
 * A textarea stand-in: these helpers only touch value, the selection pair and
 * the two focus methods, so the tests run without a DOM.
 */
function field(value: string, start: number, end = start) {
  const setSelectionRange = vi.fn();
  return {
    el: {
      value,
      selectionStart: start,
      selectionEnd: end,
      focus: vi.fn(),
      setSelectionRange,
    } as unknown as HTMLTextAreaElement,
    setSelectionRange,
  };
}

describe("insertAtCursor", () => {
  it("splices at the caret", () => {
    const { el } = field("Hi , welcome", 3);

    expect(insertAtCursor(el, "{preferredFirstName}")).toBe(
      "Hi {preferredFirstName}, welcome",
    );
  });

  it("replaces the selection", () => {
    const { el } = field("Hi NAME, welcome", 3, 7);

    expect(insertAtCursor(el, "{preferredFirstName}")).toBe(
      "Hi {preferredFirstName}, welcome",
    );
  });
});

describe("wrapSelection", () => {
  it("wraps the selected copy in the markers", () => {
    const { el } = field("<li>Renew it soon</li>", 4, 17);

    expect(wrapSelection(el, "{#ticketUrl}", "{/ticketUrl}")).toBe(
      "<li>{#ticketUrl}Renew it soon{/ticketUrl}</li>",
    );
  });

  it("inserts the placeholder when nothing is selected, not an empty block", () => {
    const { el } = field("<li></li>", 4);

    expect(
      wrapSelection(el, "{#ticketUrl}", "{/ticketUrl}", "{ticketUrl}"),
    ).toBe("<li>{#ticketUrl}{ticketUrl}{/ticketUrl}</li>");
  });

  it("leaves the wrapped text selected so it can be edited straight away", () => {
    const { el, setSelectionRange } = field("<li>Renew it soon</li>", 4, 17);

    wrapSelection(el, "{#ticketUrl}", "{/ticketUrl}");

    // Just inside the opening marker, spanning "Renew it soon".
    expect(setSelectionRange).toHaveBeenCalledWith(16, 29);
  });
});
