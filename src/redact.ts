// Centralized secret redaction for anything that reaches logs or PR comments.
// Error objects can carry provider configs, request bodies, or response text,
// so the fatal-error handler (and any future log of untrusted content) must
// pass through here first.

const knownSecrets = new Set<string>();

// Common token shapes, redacted even when the exact value was never registered.
const SECRET_PATTERNS: RegExp[] = [
  /\bsk-(ant-)?[A-Za-z0-9\-_]{8,}\b/g, // Anthropic / OpenAI style keys
  /\bxox[baprs]-[A-Za-z0-9\-_]{8,}\b/g, // Slack tokens
  /\bgh[pousr]_[A-Za-z0-9]{8,}\b/g, // GitHub tokens
  /\bBearer\s+[A-Za-z0-9\-._~+/=]{8,}/g, // Authorization headers
];

export function registerSecret(value: string | undefined): void {
  if (value && value.length >= 8) {
    knownSecrets.add(value);
  }
}

export function redactSecrets(text: string): string {
  let redacted = text;
  for (const secret of knownSecrets) {
    if (secret.length >= 8 && redacted.includes(secret)) {
      redacted = redacted.split(secret).join("[REDACTED]");
    }
  }
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted;
}

export function clearRegisteredSecrets(): void {
  knownSecrets.clear();
}
