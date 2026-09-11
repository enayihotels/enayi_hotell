// Shared "where does this role land after signing in" logic — used by
// LoginPage, GoogleSignInButton, and anywhere else that logs a user in
// directly, so the routing rules only live in one place.

const INVENTORY_ROLES = ['store_keeper', 'bar_staff', 'kitchen_staff', 'housekeeper', 'laundry_staff']
const ADMIN_ROLES = ['manager', 'admin', 'staff']

export function getPostLoginRoute(role: string): string {
  if (INVENTORY_ROLES.includes(role)) {
    // Housekeeping → their own page; all others → inventory list
    return role === 'housekeeper' ? '/housekeeping' : '/inventory'
  }
  if (ADMIN_ROLES.includes(role)) {
    return '/admin'
  }
  // Guest (default)
  return '/dashboard'
}
