import { AxiosError } from "axios";

/**
 * Turn a failed request into a sentence that says what actually went wrong.
 *
 * Every route in this feature already returns the underlying cause in `details`
 * — the SMTP error, the database error — and the first version of this editor
 * threw all of it away in favour of "Could not send the test email". That made a
 * plain environment problem (an SMTP server whose certificate Node would not
 * trust) look like a bug in the page, which is exactly the diagnosis this text
 * is supposed to make unnecessary.
 *
 * `action` is an infinitive phrase, e.g. "render the preview".
 */
export function describeRequestError(
  err: unknown,
  action: string,
  timeoutHint?: string,
): string {
  if (!(err instanceof AxiosError)) {
    return err instanceof Error
      ? `Could not ${action}: ${err.message}`
      : `Could not ${action}.`;
  }

  if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
    return timeoutHint ?? `Timed out waiting for the server to ${action}.`;
  }

  if (err.response === undefined) {
    return `Could not reach the server (${err.message}).`;
  }

  const status = err.response.status;
  if (status === 401) {
    return "Your session has expired — reload the page and sign in again.";
  }
  if (status === 403) {
    return `You do not have permission to ${action}.`;
  }

  const data = err.response.data as
    | { error?: string; message?: string; details?: string }
    | undefined;
  const headline =
    data?.error ?? data?.message ?? `The server returned ${status}.`;

  // The details are the useful half — an SMTP rejection, a missing template —
  // so they are appended rather than replacing the headline, which names the
  // operation that failed.
  return data?.details !== undefined && data.details !== headline
    ? `${headline} — ${data.details}`
    : headline;
}
