const SESSION_RESET_SNIPPETS = [
  "User from sub claim in JWT does not exist",
  "Invalid API key",
  "JWT expired",
] as const;

export function isSessionInvalidError(message?: string | null) {
  if (!message) {
    return false;
  }

  return SESSION_RESET_SNIPPETS.some((snippet) => message.includes(snippet));
}


