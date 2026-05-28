import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { lazy, Suspense } from 'react'

// Layouts
import PublicLayout    from '@/components/layout/PublicLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import AdminLayout     from '@/components/layout/AdminLayout'

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
const AdminOrders       = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminEvents       = lazy(() => import('@/pages/admin/AdminEvents'))
const AdminGallery      = lazy(() => import('@/pages/admin/AdminGallery'))
const AdminGuests       = lazy(() => import('@/pages/admin/AdminGuests'))
const AdminPayments     = lazy(() => import('@/pages/admin/AdminPayments'))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } }
})

const Spinner = () => (
  <div className="flex items-center justify-center h-screen bg-enayi-bg">
    <div className="w-8 h-8 border-2 border-enayi-border border-t-enayi-gold rounded-full animate-spin" />
  </div>
)

function Guard({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (adminOnly && !['admin', 'manager', 'staff'].includes(user?.role ?? ''))
    return <Navigate to="/dashboard" replace />
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
        <Suspense fallback={<Spinner />}>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/"         element={<LandingPage />} />
              <Route path="/rooms"    element={<RoomsPage />} />
              <Route path="/rooms/:slug" element={<RoomDetailPage />} />
              <Route path="/gallery"  element={<GalleryPage />} />
              <Route path="/events"   element={<EventsPage />} />
              <Route path="/about"    element={<AboutPage />} />
              <Route path="/contact"  element={<ContactPage />} />
            </Route>

            {/* Auth */}
            <Route path="/login"            element={<LoginPage />} />
            <Route path="/register"         element={<RegisterPage />} />
            <Route path="/forgot-password"  element={<ForgotPasswordPage />} />
            <Route path="/reset-password"   element={<ResetPasswordPage />} />
            <Route path="/verify-email"     element={<VerifyEmailPage />} />

            {/* Guest Dashboard */}
            <Route element={<Guard><DashboardLayout /></Guard>}>
              <Route path="/dashboard"       element={<DashboardPage />} />
              <Route path="/book"            element={<BookingPage />} />
              <Route path="/book/:slug"      element={<BookingPage />} />
              <Route path="/my-bookings"     element={<MyBookingsPage />} />
              <Route path="/orders"          element={<OrdersPage />} />
              <Route path="/events/book"     element={<EventBookingPage />} />
              <Route path="/events/my"       element={<MyEventsPage />} />
              <Route path="/payment/:id"     element={<PaymentPage />} />
              <Route path="/payment/callback" element={<PaymentCallback />} />
              <Route path="/profile"         element={<ProfilePage />} />
              <Route path="/concierge"       element={<AIConcierge />} />
            </Route>

            {/* Admin */}
            <Route element={<Guard adminOnly><AdminLayout /></Guard>}>
              <Route path="/admin"           element={<AdminDashboard />} />
              <Route path="/admin/rooms"     element={<AdminRooms />} />
              <Route path="/admin/bookings"  element={<AdminBookings />} />
              <Route path="/admin/orders"    element={<AdminOrders />} />
              <Route path="/admin/events"    element={<AdminEvents />} />
              <Route path="/admin/gallery"   element={<AdminGallery />} />
              <Route path="/admin/guests"    element={<AdminGuests />} />
              <Route path="/admin/payments"  element={<AdminPayments />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

