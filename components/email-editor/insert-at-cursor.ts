/**
 * Splice `text` into an input/textarea at the caret and return the new value.
 *
 * The caret is restored just past the inserted text so an author can click
 * several token chips in a row and get them in the order they clicked, rather
 * than having each one land back at the start.
 */
export function insertAtCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  text: string,
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + text + el.value.slice(end);

  // The caret has to be set after React has re-rendered with the new value,
  // otherwise the DOM update wipes it.
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + text.length, start + text.length);
  });

  return next;
}

/**
 * Surround the selection with `before` and `after` and return the new value,
 * leaving the wrapped text selected so it can be wrapped again or replaced.
 *
 * With nothing selected, `placeholder` is inserted between the two so the
 * result is still a complete construct — wrapping "nothing" in `{#token}…{/token}`
 * would otherwise produce an empty block that does nothing visible.
 */
export function wrapSelection(
  el: HTMLInputElement | HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "",
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const inner = start === end ? placeholder : el.value.slice(start, end);
  const next =
    el.value.slice(0, start) + before + inner + after + el.value.slice(end);

  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + before.length, start + before.length + inner.length);
  });

  return next;
}
