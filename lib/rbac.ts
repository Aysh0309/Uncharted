import { ObjectId } from "mongodb";
import { UserRole, UserSession } from "./auth";
import { getDb } from "./db";

/**
 * Checks whether a user's role is permitted.
 */
export function requireRole(
  user: UserSession | null,
  allowedRoles: UserRole[]
): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Determines whether a user can read/view a given case data object.
 * - Admin sees all cases.
 * - Investigator and Viewer only see cases where user.id is in memberIds.
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
 * Determines whether a user can access a case by its caseId (checks database if non-admin).
 */
export async function canAccessCaseById(
  user: UserSession,
  caseId: string
): Promise<boolean> {
  if (user.role === "admin") {
    return true;
  }

  try {
    const db = await getDb();
    const query: Record<string, any> = {
      memberIds: user.id,
    };

    if (ObjectId.isValid(caseId)) {
      query._id = new ObjectId(caseId);
    } else {
      query._id = caseId;
    }

    const found = await db.collection("cases").findOne(query, {
      projection: { _id: 1 },
    });

    return !!found;
  } catch {
    return false;
  }
}

/**
 * Determines whether a user can write to a case (add facts, edit entities).
 * - Admin can write to all cases.
 * - Investigator can write ONLY to assigned cases.
 * - Viewer CANNOT write to any case (read-only).
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

/**
 * Determines whether a user can write to a case by caseId.
 */
export async function canWriteCaseById(
  user: UserSession,
  caseId: string
): Promise<boolean> {
  if (user.role === "viewer") {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  return canAccessCaseById(user, caseId);
}

/**
 * Builds a MongoDB query filter scoped to cases the user is permitted to view.
 * - Admin sees all: {}
 * - Investigator/Viewer sees only assigned cases: { memberIds: user.id }
 */
export function getAuthorizedCaseFilter(user: UserSession): Record<string, any> {
  if (user.role === "admin") {
    return {};
  }
  return { memberIds: user.id };
}
