import { isCloudflareEmailConfigured } from "./cloudflare-email";
import { isSmtpConfigured } from "./smtp-config";

export function isEmailConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    Boolean(env.SMTP_FROM) &&
    (isSmtpConfigured(env) || isCloudflareEmailConfigured(env))
  );
}
