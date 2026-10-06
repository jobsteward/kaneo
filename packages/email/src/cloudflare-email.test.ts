import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { sendCloudflareEmail } from "./cloudflare-email";
import { isEmailConfigured } from "./email-config";
import { sendNotificationEmail } from "./send-email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const env = {
  CLOUDFLARE_EMAIL_ACCOUNT_ID: "account",
  CLOUDFLARE_EMAIL_API_TOKEN: "test-token",
  SMTP_FROM: "notifications@example.test",
};
const message = {
  from: env.SMTP_FROM,
  to: "user@example.test",
  subject: "Workspace invitation",
  html: "<p>Join your workspace.</p>",
};
const response = (result: object) => Response.json({ success: true, result });

describe("Cloudflare email delivery", () => {
  it("sends a rendered notification through HTTPS", async () => {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    const request = vi.fn().mockResolvedValue(
      response({
        delivered: [message.to],
        queued: [],
        permanent_bounces: [],
      }),
    );
    vi.stubGlobal("fetch", request);

    await expect(
      sendNotificationEmail(message.to, message.subject, {
        title: "Task assigned",
        message: "Review the estimate.",
      }),
    ).resolves.toEqual({ success: true });
    const sent = JSON.parse(request.mock.calls[0][1].body);
    expect(sent.to).toBe(message.to);
    expect(sent.html).toContain("Review the estimate.");
  });

  it.each(["delivered", "queued"])("accepts a %s recipient", async (status) => {
    const request = vi.fn().mockResolvedValue(
      response({
        delivered: status === "delivered" ? [message.to] : [],
        queued: status === "queued" ? [message.to] : [],
        permanent_bounces: [],
      }),
    );

    await expect(sendCloudflareEmail(message, env, request)).resolves.toEqual({
      accepted: [message.to],
    });
    const [url, options] = request.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/account/email/sending/send",
    );
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(options.body)).toEqual(message);
  });

  it("rejects a bounced recipient", async () => {
    const request = vi.fn().mockResolvedValue(
      response({
        delivered: [],
        queued: [],
        permanent_bounces: [message.to],
      }),
    );
    await expect(sendCloudflareEmail(message, env, request)).rejects.toThrow(
      "did not accept the email recipient",
    );
  });

  it("rejects a malformed success response", async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ success: true }));
    await expect(sendCloudflareEmail(message, env, request)).rejects.toThrow(
      "invalid email delivery response",
    );
  });

  it("does not include provider error content in errors", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        new Response("test-token private message", { status: 403 }),
      );
    await expect(sendCloudflareEmail(message, env, request)).rejects.toThrow(
      "Cloudflare email request failed (HTTP 403)",
    );
  });

  it("requires credentials before sending", async () => {
    const request = vi.fn();
    await expect(sendCloudflareEmail(message, {}, request)).rejects.toThrow(
      "not configured",
    );
    expect(request).not.toHaveBeenCalled();
  });

  it("does not expose network error content", async () => {
    const request = vi
      .fn()
      .mockRejectedValue(new Error("test-token private message"));
    await expect(sendCloudflareEmail(message, env, request)).rejects.toThrow(
      "Cloudflare email connection failed",
    );
  });
});

describe("email configuration", () => {
  it("enables Cloudflare without an SMTP host", () => {
    expect(isEmailConfigured(env)).toBe(true);
  });

  it("retains SMTP support", () => {
    expect(
      isEmailConfigured({ SMTP_HOST: "relay", SMTP_FROM: message.from }),
    ).toBe(true);
  });

  it("disables incomplete email configuration", () => {
    expect(
      isEmailConfigured({ CLOUDFLARE_EMAIL_API_TOKEN: "test-token" }),
    ).toBe(false);
    expect(isEmailConfigured({ ...env, SMTP_FROM: undefined })).toBe(false);
  });
});
