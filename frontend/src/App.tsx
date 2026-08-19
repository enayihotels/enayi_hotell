import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/utils/queryClient'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { lazy, Suspense } from 'react'

// Layouts
import PublicLayout    from '@/components/layout/PublicLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminLayout     from '@/components/layout/AdminLayout'
import InventoryLayout from '@/components/layout/InventoryLayout'
import InstallPrompt   from '@/components/InstallPrompt'
import UpdatePrompt    from '@/components/UpdatePrompt'

// Public Pages
const LandingPage    =lazy(() => import("@/pages/public/LandingPage"));
const RoomsPage      = lazy(() => import('@/pages/public/RoomsPage'))
const RoomDetailPage = lazy(() => import('@/pages/public/RoomDetailPage'))
const GalleryPage    = lazy(() => import('@/pages/public/GalleryPage'))
const EventsPage     = lazy(() => import('@/pages/public/EventsPage'))
const AboutPage      = lazy(() => import('@/pages/public/AboutPage'))
const ContactPage    = lazy(() => import('@/pages/public/ContactPage'))

// Auth Pages
const LoginPage          = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage       = lazy(() => import('@/pages/auth/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage  = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const VerifyEmailPage    = lazy(() => import('@/pages/auth/VerifyEmailPage'))

// Guest Pages
const DashboardPage     = lazy(() => import('@/pages/guest/DashboardPage'))
const BookingPage       = lazy(() => import('@/pages/guest/BookingPage'))
const MyBookingsPage    = lazy(() => import('@/pages/guest/MyBookingsPage'))
const OrdersPage        = lazy(() => import('@/pages/guest/OrdersPage'))
const MyOrdersPage      = lazy(() => import('@/pages/guest/MyOrdersPage'))
const EventBookingPage  = lazy(() => import('@/pages/guest/EventBookingPage'))
const MyEventsPage      = lazy(() => import('@/pages/guest/MyEventsPage'))
const PaymentPage       = lazy(() => import('@/pages/guest/PaymentPage'))
const PaymentCallback   = lazy(() => import('@/pages/guest/PaymentCallback'))
const ProfilePage       = lazy(() => import('@/pages/guest/ProfilePage'))
const AIConcierge       = lazy(() => import('@/pages/guest/AIConcierge'))

// Admin Pages
const AdminDashboard    = lazy(() => import('@/pages/admin/AdminDashboard'))
const AdminRooms        = lazy(() => import('@/pages/admin/AdminRooms'))
const AdminBookings     = lazy(() => import('@/pages/admin/AdminBookings'))
const AdminCheckoutApprovals = lazy(() => import('@/pages/admin/AdminCheckoutApprovals'))
const AdminFraudReports = lazy(() => import('@/pages/admin/AdminFraudReports'))
const AdminOrders       = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminEvents       = lazy(() => import('@/pages/admin/AdminEvents'))
const AdminGallery      = lazy(() => import('@/pages/admin/AdminGallery'))
const AdminGuests       = lazy(() => import('@/pages/admin/AdminGuests'))
const AdminPayments     = lazy(() => import('@/pages/admin/AdminPayments'))
const AdminInventory    = lazy(() => import('@/pages/admin/AdminInventory'))
const AdminAssets       = lazy(() => import('@/pages/admin/AdminAssets'))
const HousekeepingPage  = lazy(() => import('@/pages/admin/HousekeepingPage'))
const MenuManagerPage   = lazy(() => import('@/pages/admin/MenuManagerPage'))
const MyAssetsPage      = lazy(() => import('@/pages/admin/MyAssetsPage'))

const Spinner = () => (
  <div className="flex items-center justify-center h-screen bg-enayi-bg">
    <div className="w-8 h-8 border-2 border-enayi-border border-t-enayi-gold rounded-full animate-spin" />
  </div>
)

function Guard({ children, adminOnly = false, inventoryOnly = false, conciergeOnly = false }: { children: React.ReactNode; adminOnly?: boolean; inventoryOnly?: boolean; conciergeOnly?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />

  const role = user?.role ?? ''
  const INVENTORY_ROLES = ['store_keeper', 'bar_staff', 'kitchen_staff', 'housekeeper']
  const ADMIN_ROLES = ['manager', 'admin']

  // ENAYI AI Agent — all authenticated roles allowed, no redirect
  if (conciergeOnly) return <>{children}</>

  // Admin panel is for Manager and Owner only
  if (adminOnly && !ADMIN_ROLES.includes(role))
    return <Navigate to="/dashboard" replace />

  // Inventory shell — bar/kitchen/housekeeper/store keeper
  if (inventoryOnly && ![...INVENTORY_ROLES, ...ADMIN_ROLES].includes(role))
    return <Navigate to="/dashboard" replace />

  // Guest portal — if a staff member somehow lands here, route them to the
  // right place rather than letting them browse the guest-facing portal.
  if (!adminOnly && !inventoryOnly) {
    if (INVENTORY_ROLES.includes(role))
      return <Navigate to={role === 'housekeeper' ? '/housekeeping' : '/inventory'} replace />
    if (ADMIN_ROLES.includes(role))
      return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background:'#16161F', color:'#EAE6DC', border:'1px solid rgba(201,168,76,0.2)', borderRadius:'12px', fontFamily:'"DM Sans",sans-serif', fontSize:'14px' },
          success: { iconTheme: { primary:'#C9A84C', secondary:'#09090E' } },
          error:   { iconTheme: { primary:'#f87171', secondary:'#EAE6DC' } },
        }} />
        <InstallPrompt />
        <UpdatePrompt />
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/"         element={<LandingPage key="landing" />} />
              <Route path="/rooms"    element={<RoomsPage key="rooms" />} />
              <Route path="/rooms/:slug" element={<RoomDetailPage key="room-detail" />} />
              <Route path="/gallery"  element={<GalleryPage key="gallery" />} />
              <Route path="/events"   element={<EventsPage key="events" />} />
              <Route path="/about"    element={<AboutPage key="about" />} />
              <Route path="/contact"  element={<ContactPage key="contact" />} />
            </Route>

            {/* Auth */}
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/register"         element={<RegisterPage />} />
            <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />
            <Route path="/verify-email"     element={<VerifyEmailPage />} />

            {/* Guest Dashboard */}
            <Route element={<Guard><DashboardLayout /></Guard>}>
              <Route path="/dashboard"       element={<DashboardPage key="dashboard" />} />
              <Route path="/book"            element={<BookingPage key="book" />} />
              <Route path="/book/:slug"      element={<BookingPage key="book-slug" />} />
              <Route path="/my-bookings"     element={<MyBookingsPage key="my-bookings" />} />
              <Route path="/orders"          element={<OrdersPage key="orders" />} />
              <Route path="/my-orders"       element={<MyOrdersPage key="my-orders" />} />
              <Route path="/events/book"     element={<EventBookingPage key="events-book" />} />
              <Route path="/events/my"       element={<MyEventsPage key="events-my" />} />
              <Route path="/payment/:id"     element={<PaymentPage key="payment-id" />} />
              <Route path="/payment/callback" element={<PaymentCallback key="payment-callback" />} />
              <Route path="/profile"         element={<ProfilePage key="profile" />} />
            </Route>

            {/* ENAYI AI Agent — standalone, accessible to ALL authenticated
                roles (guest, admin, manager, staff). Kept outside the
                guest-only Guard so Admin/Manager clicking the nav link
                aren't redirected away to /admin before reaching it. */}
            <Route element={<Guard conciergeOnly><DashboardLayout /></Guard>}>
              <Route path="/concierge" element={<AIConcierge key="concierge" />} />
            </Route>

            {/* Admin */}
            <Route element={<Guard adminOnly><AdminLayout /></Guard>}>
              <Route path="/admin"           element={<AdminDashboard key="admin-dashboard" />} />
              <Route path="/admin/rooms"     element={<AdminRooms key="admin-rooms" />} />
              <Route path="/admin/bookings"  element={<AdminBookings key="admin-bookings" />} />
              <Route path="/admin/checkout-approvals" element={<AdminCheckoutApprovals key="admin-checkout-approvals" />} />
              <Route path="/admin/fraud-reports" element={<AdminFraudReports key="admin-fraud-reports" />} />
              <Route path="/admin/orders"    element={<AdminOrders key="admin-orders" />} />
              <Route path="/admin/events"    element={<AdminEvents key="admin-events" />} />
              <Route path="/admin/gallery"   element={<AdminGallery key="admin-gallery" />} />
              <Route path="/admin/guests"    element={<AdminGuests key="admin-guests" />} />
              <Route path="/admin/payments"  element={<AdminPayments key="admin-payments" />} />
              <Route path="/admin/inventory" element={<AdminInventory key="admin-inventory" />} />
              <Route path="/admin/assets"    element={<AdminAssets key="admin-assets" />} />
            </Route>

            {/* Store / Bar / Kitchen — a separate, lightweight shell so
                these roles only ever see Inventory, not the full admin
                panel with Bookings/Rooms/Guests/etc. that isn't their job. */}
            <Route element={<Guard inventoryOnly><InventoryLayout /></Guard>}>
              <Route path="/inventory" element={<AdminInventory key="inventory" />} />
              <Route path="/inventory/orders" element={<AdminOrders key="inventory-orders" />} />
              <Route path="/inventory/menu" element={<MenuManagerPage key="inventory-menu" />} />
              <Route path="/inventory/assets" element={<MyAssetsPage key="inventory-assets" />} />
              <Route path="/housekeeping" element={<HousekeepingPage key="housekeeping" />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

