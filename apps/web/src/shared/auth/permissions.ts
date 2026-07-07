export type Role = 'staff' | 'manager' | 'admin';

export function canManageStations(role?: string): boolean {
  return role === 'admin';
}

export function canEnterFuel(role?: string): boolean {
  return role === 'admin' || role === 'manager';
}
