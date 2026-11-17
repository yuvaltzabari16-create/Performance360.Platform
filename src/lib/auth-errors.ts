/**
 * Sign-up errors that would tell a stranger an email address already has an account.
 * Those are answered exactly like a successful sign-up ("check your email"), so the form cannot be used to
 * find out who is registered. Other errors (weak password, rate limit) say nothing about other accounts.
 */
export function revealsExistingAccount(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "user_already_exists" || error.code === "email_exists") return true;
  return /already (been )?registered|already exists/i.test(error.message ?? "");
}
