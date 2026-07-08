export function isAnonymousUser(user: { is_anonymous?: boolean } | null | undefined): boolean {
  return Boolean(user?.is_anonymous);
}

export function isPermanentUser(user: { is_anonymous?: boolean; email?: string | null } | null | undefined): boolean {
  return Boolean(user && !user.is_anonymous);
}
