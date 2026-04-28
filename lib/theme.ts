import type { Theme } from './types';

/**
 * Effective theme = role.theme_override ?? user.theme_preference ?? 'system'.
 * A non-null `theme_override` is a force — the UI hides the toggle.
 */
export function resolveTheme(
  userPreference: Theme | null | undefined,
  roleOverride: Theme | null | undefined,
): { theme: Theme; locked: boolean } {
  if (roleOverride) return { theme: roleOverride, locked: true };
  return { theme: userPreference ?? 'system', locked: false };
}
