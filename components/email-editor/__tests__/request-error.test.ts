import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { describeRequestError } from "../request-error";

/** An AxiosError carrying a response, as a failing route handler produces. */
function withResponse(status: number, data?: unknown): AxiosError {
  const err = new AxiosError("Request failed", "ERR_BAD_RESPONSE");
  err.response = {
    status,
    data,
    statusText: "",
    headers: {},
    config: { headers: {} } as never,
  };
  return err;
}

describe("describeRequestError", () => {
  it("keeps the server's details — the half that says what broke", () => {
    const err = withResponse(500, {
      error: "Could not send the test email",
      details: "self-signed certificate",
    });

    expect(describeRequestError(err, "send the test email")).toBe(
      "Could not send the test email — self-signed certificate",
    );
  });

  it("falls back to the headline when there are no details", () => {
    const err = withResponse(404, { error: "Template not found" });

    expect(describeRequestError(err, "render the preview")).toBe(
      "Template not found",
    );
  });

  it("does not repeat identical headline and details", () => {
    const err = withResponse(500, { error: "Boom", details: "Boom" });

    expect(describeRequestError(err, "render the preview")).toBe("Boom");
  });

  it("reads the `message` key too, which the auth guard uses", () => {
    const err = withResponse(400, { message: "subject and body are required" });

    expect(describeRequestError(err, "render the preview")).toBe(
      "subject and body are required",
    );
  });

  it("names the status when the body carries nothing usable", () => {
    expect(describeRequestError(withResponse(502), "render the preview")).toBe(
      "The server returned 502.",
    );
  });

  it("tells an expired session apart from a permission problem", () => {
    expect(describeRequestError(withResponse(401), "save the template")).toContain(
      "session has expired",
    );
    expect(describeRequestError(withResponse(403), "save the template")).toBe(
      "You do not have permission to save the template.",
    );
  });

  it("uses the caller's hint on timeout, since a test send may still arrive", () => {
    const err = new AxiosError("timeout of 60000ms exceeded", "ECONNABORTED");

    expect(
      describeRequestError(err, "send the test email", "Still might arrive."),
    ).toBe("Still might arrive.");
    expect(describeRequestError(err, "render the preview")).toBe(
      "Timed out waiting for the server to render the preview.",
    );
  });

  it("says the server was unreachable when there is no response at all", () => {
    const err = new AxiosError("Network Error", "ERR_NETWORK");

    expect(describeRequestError(err, "render the preview")).toBe(
      "Could not reach the server (Network Error).",
    );
  });

  it("handles a plain Error and a non-Error throw", () => {
    expect(describeRequestError(new Error("kaboom"), "render the preview")).toBe(
      "Could not render the preview: kaboom",
    );
    expect(describeRequestError("nope", "render the preview")).toBe(
      "Could not render the preview.",
    );
  });
});
