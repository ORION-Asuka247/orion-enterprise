/** A saved preference never grants access: it must still exist in current memberships. */
export function resolveTenant<T extends { id: string }>(memberships: T[], preferredId: string | null): T | null {
  return memberships.find(t => t.id === preferredId) ?? memberships[0] ?? null;
}
