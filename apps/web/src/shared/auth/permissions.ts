export type Role = 'staff' | 'manager' | 'admin';

export function canManageStations(role?: string): boolean {
  return role === 'admin';
}

export function canEnterFuel(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}

/** User administration is admin-only and never delegated — mirrors the auth-service guard. */
export function canManageUsers(role?: string): boolean {
  return role === 'admin';
}

/** Anyone signed in may propose a station; only these roles may turn a proposal into one. */
export function canReviewStationRequests(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}
