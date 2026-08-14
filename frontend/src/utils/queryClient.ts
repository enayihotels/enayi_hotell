import { QueryClient } from '@tanstack/react-query'

// Previously created inline inside App.tsx. Moved here so authStore's
// logout() can import it directly and clear it — this is what actually
// wipes a signed-out user's cached bookings/orders/payments from memory
// before the next person logs in on the same browser or device. Without
// this, React Query keeps serving the stale cached data under the same
// query keys (e.g. ['my-orders']) for a moment after a new user signs
// in, until a fresh fetch overwrites it — on a shared front-desk
// machine, that's a real privacy issue, not just a cosmetic one.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } }
})
