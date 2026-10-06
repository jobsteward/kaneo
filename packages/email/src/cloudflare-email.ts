import { z } from "zod";

export type EmailMessage = {
  from?: string;
  to: string;
  subject: string;
  html: string;
};

type EmailEnv = Record<string, string | undefined>;

const delivery = z.object({
  success: z.literal(true),
  result: z.object({
    delivered: z.array(z.string()),
    queued: z.array(z.string()),
    permanent_bounces: z.array(z.string()),
  }),
});

export function isCloudflareEmailConfigured(env: EmailEnv = process.env) {
  return Boolean(
    env.CLOUDFLARE_EMAIL_ACCOUNT_ID && env.CLOUDFLARE_EMAIL_API_TOKEN,
  );
}

export async function sendCloudflareEmail(
  message: EmailMessage,
  env: EmailEnv = process.env,
  request: typeof fetch = fetch,
) {
  if (!isCloudflareEmailConfigured(env) || !message.from) {
    throw new Error("Cloudflare email is not configured");
  }

  const response = await request(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_EMAIL_ACCOUNT_ID ?? "")}/email/sending/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.CLOUDFLARE_EMAIL_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(10_000),
    },
  ).catch(() => {
    throw new Error("Cloudflare email connection failed");
  });

  if (!response.ok) {
    throw new Error(
      `Cloudflare email request failed (HTTP ${response.status})`,
    );
  }

  const result = delivery.safeParse(await response.json().catch(() => null));
  if (!result.success) {
    throw new Error("Cloudflare returned an invalid email delivery response");
  }

  const accepted = [
    ...result.data.result.delivered,
    ...result.data.result.queued,
  ];
  if (
    !accepted.some(
      (address) => address.toLowerCase() === message.to.toLowerCase(),
    )
  ) {
    throw new Error("Cloudflare did not accept the email recipient");
  }

  return { accepted: [message.to] };
}
