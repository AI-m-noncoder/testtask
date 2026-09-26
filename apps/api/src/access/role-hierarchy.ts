import { SYSTEM_ROLES, SystemRole } from './access.constants.js';

const TOP_LEVEL = SYSTEM_ROLES[SystemRole.Admin].level;

/**
 * A member can assign roles / manage members strictly below their own level.
 * Admins are the top of the hierarchy and may also manage other admins
 * (the "last admin" invariant is enforced separately).
 */
export function canManageLevel(actorLevel: number, targetLevel: number): boolean {
  return targetLevel < actorLevel || actorLevel >= TOP_LEVEL;
}
