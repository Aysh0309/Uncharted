import { UserRole, UserSession } from "./auth";

/**
 * Checks whether a user's role is in the allowed roles list.
 */
export function requireRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Determines whether a user can access (read/view) a case.
 * - Admin can access all cases.
 * - Investigators and Viewers can only access cases where their ID is in memberIds.
 */
export function canAccessCase(
  user: UserSession,
  caseData: { memberIds?: string[] | null }
): boolean {
  if (user.role === "admin") {
    return true;
  }

  if (!caseData || !Array.isArray(caseData.memberIds)) {
    return false;
  }

  return caseData.memberIds.includes(user.id);
}

/**
 * Determines whether a user has write permissions on a case (e.g. adding facts, editing entities).
 * - Admin can write to all cases.
 * - Investigator can write to assigned cases.
 * - Viewers CANNOT write to any case (read-only).
 */
export function canWriteCase(
  user: UserSession,
  caseData: { memberIds?: string[] | null }
): boolean {
  if (user.role === "viewer") {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "investigator") {
    return canAccessCase(user, caseData);
  }

  return false;
}

