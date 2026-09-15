// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "./store/stores"
import { AppLayout }     from "./components/layout/AppLayout"
import InstallPrompt     from "./components/InstallPrompt"

// ── Existing pages ────────────────────────────────────────────────────────────
import LoginPage           from "./pages/auth/LoginPage"
import MFAVerifyPage       from "./pages/auth/MFAVerifyPage"
import AITutorPage         from "./pages/student/AITutorPage"
import NotFoundPage        from "./pages/NotFoundPage"

// ── Curriculum pages ──────────────────────────────────────────────────────────
import LessonPlanner       from "./pages/curriculum/LessonPlanner"
import SlideGenerator      from "./pages/curriculum/SlideGenerator"
import WorksheetGenerator  from "./pages/curriculum/WorksheetGenerator"
import TemplateFill        from "./pages/curriculum/TemplateFill"
import EYFSMathsWorksheets from "./pages/curriculum/EYFSMathsWorksheets"
import EYFSContentGenerator from "./pages/curriculum/EYFSContentGenerator"

// ── Assessment ────────────────────────────────────────────────────────────────
import ResultEntry         from "./pages/results/ResultEntry"
import CBTPage             from "./pages/cbt/CBTPage"

// ── Notifications ──────────────────────────────────────────────────────────────
import NotificationsPage   from "./pages/notifications/NotificationsPage"

// ── Attendance ─────────────────────────────────────────────────────────────────
import AttendancePage      from "./pages/attendance/AttendancePage"

// ── Fees, Settings ────────────────────────────────────────────────────────
import FeesPage            from "./pages/fees/FeesPage"
import SettingsPage        from "./pages/settings/SettingsPage"

// ── Admin: Timetable Generator ───────────────────────────────────────────────
import TimetableGenerator  from "./pages/admin/TimetableGenerator"

// ── Admin: Classes (create classes within a Year Group) ─────────────────────
import ClassesPage         from "./pages/admin/ClassesPage"

// ── Admin: Staff & Assignments (bulk-create teachers + timetable links) ─────
import StaffPage           from "./pages/admin/StaffPage"

// ── Admin: Class Roster (Year Group -> Class -> students & teachers) ────────
import ClassRosterPage     from "./pages/admin/ClassRosterPage"

// ── Classroom (Google-Classroom-equivalent) & Portal Accounts ───────────────
import ClassroomPage       from "./pages/classroom/ClassroomPage"
import PeopleAccountsPage  from "./pages/admin/PeopleAccountsPage"
import RegistrarDatabankPage from "./pages/admin/RegistrarDatabankPage"
import AccountPage         from "./pages/account/AccountPage"

// ── Admin pages (batch fix) ───────────────────────────────────────────────────
import DemoDataGenerator     from "./pages/admin/DemoDataGenerator"
import DocumentVerification  from "./pages/admin/DocumentVerification"
import StaffRetention        from "./pages/admin/StaffRetention"
import AccreditationPortfolio from "./pages/admin/AccreditationPortfolio"
import ComplianceReports     from "./pages/admin/ComplianceReports"
import SafetyIncidents       from "./pages/admin/SafetyIncidents"
import FinancePage           from "./pages/admin/FinancePage"
import PTAPortal             from "./pages/parent/PTAPortal"

// ── Dashboard ─────────────────────────────────────────────────────────────────
import SmartDashboard      from "./pages/dashboards/RoleDashboards"

function RequireAuth({ children, minRole }: {
  children: React.ReactNode
  minRole?: string
}) {
  const { isAuthenticated, mfaPending, canAccess } = useAuth()
  if (!isAuthenticated && !mfaPending) return <Navigate to="/login" replace />
  if (mfaPending) return <Navigate to="/verify-mfa" replace />
  if (minRole && !canAccess(minRole as any)) return <Navigate to="/unauthorized" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <>
      <Routes>
      {/* ── Public ── */}
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/verify-mfa" element={<MFAVerifyPage />} />

      {/* ── Protected ── */}
      <Route path="/" element={
        <RequireAuth><AppLayout /></RequireAuth>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="dashboard"      element={<SmartDashboard />} />

        {/* AI Tools */}
        <Route path="ai-tutor"       element={<AITutorPage />} />

        {/* Curriculum */}
        <Route path="lesson-planner" element={
          <RequireAuth minRole="teacher"><LessonPlanner /></RequireAuth>
        } />
        <Route path="template-fill"  element={
          <RequireAuth minRole="teacher"><TemplateFill /></RequireAuth>
        } />
        <Route path="slides"         element={
          <RequireAuth minRole="teacher"><SlideGenerator /></RequireAuth>
        } />
        <Route path="worksheets"     element={
          <RequireAuth minRole="teacher"><WorksheetGenerator /></RequireAuth>
        } />
        <Route path="eyfs-worksheets" element={
          <RequireAuth minRole="teacher"><EYFSMathsWorksheets /></RequireAuth>
        } />
        <Route path="eyfs-lesson-plan" element={<Navigate to="/lesson-planner?panel=eyfs" replace />} />
        <Route path="eyfs-content-generator" element={
          <RequireAuth minRole="teacher"><EYFSContentGenerator /></RequireAuth>
        } />

        {/* Retired - fully covered by lesson-planner's British mode
            (Year 1-6), which posts to the exact same
            /api/ai/ks-lesson-plan/ endpoint this page did. */}
        <Route path="ks-lesson-plan" element={<Navigate to="/lesson-planner" replace />} />

        {/* Assessment */}
        <Route path="results"        element={
          <RequireAuth minRole="teacher"><ResultEntry /></RequireAuth>
        } />
        <Route path="cbt"            element={<CBTPage />} />

        {/* Notifications - open to all authenticated roles, matching the sidebar config */}
        <Route path="notifications"  element={<NotificationsPage />} />

        {/* Attendance - teacher/principal only, matching the sidebar config */}
        <Route path="attendance"     element={
          <RequireAuth minRole="teacher"><AttendancePage /></RequireAuth>
        } />

        {/* Redirects to the unified Parents & Pupils/Students page below -
            kept as separate routes (rather than deleted) so any existing
            bookmark or internal link to the old URL still lands somewhere
            correct, just on the matching tab. */}
        <Route path="students" element={<Navigate to="/admin/people?tab=roster" replace />} />

        {/* Fees / Settings - sidebar roles don't fit minRole's linear hierarchy
            (Fees: accountant/principal/owner/parent, no teacher;
             Settings: principal/owner/superadmin only). Defaulted to
             minRole="principal" as the conservative, safer-by-default
             choice for financial/settings data - please verify this
             actually matches your intended access rules, especially
             whether parents need direct Fees access (this would
             currently block them unless the role hierarchy treats
             "parent" as >= "principal", which seems unlikely). */}
        <Route path="fees"           element={
          <RequireAuth minRole="principal"><FeesPage /></RequireAuth>
        } />
        <Route path="settings"       element={
          <RequireAuth minRole="principal"><SettingsPage /></RequireAuth>
        } />

        {/* Admin: Timetable Generator - path matches the /admin/timetable
            URL you hit the 404 on. No sidebar link exists in my copy of
            AppLayout.tsx for this page, so I can't confirm the intended
            role restriction the same way as the other fixes this session -
            defaulted to minRole="principal" (same conservative choice as
            Fees/Settings) - please verify. */}
        <Route path="admin/timetable" element={
          <RequireAuth minRole="principal"><TimetableGenerator /></RequireAuth>
        } />

        {/* Admin: Classes - create/manage classes within a Year Group,
            for both British and Nigerian curriculums. Same minRole as
            the other admin pages above. */}
        <Route path="admin/classes" element={
          <RequireAuth minRole="principal"><ClassesPage /></RequireAuth>
        } />

        {/* Admin: Staff & Assignments - bulk-create teacher accounts and
            link them to subjects/classes for timetabling. */}
        <Route path="admin/staff" element={
          <RequireAuth minRole="principal"><StaffPage /></RequireAuth>
        } />

        {/* Class Roster - Year Group -> Class -> real students & teachers.
            Available to teachers too (not just admin), since any teacher
            reasonably needs to look up who's in a specific class. */}
        <Route path="admin/class-roster" element={
          <RequireAuth minRole="teacher"><ClassRosterPage /></RequireAuth>
        } />

        {/* Admin pages (batch fix) - paths match the exact URLs confirmed
            in your 404 screenshots. Same caveat as timetable: no sidebar
            links exist in my copy of AppLayout.tsx for these, so role
            restrictions are my best-guess defaults, not verified against
            your actual nav config - please check.
            NOTE the inconsistent URL structure across these (some under
            /admin/, some not) - that's not something I introduced, it's
            just what the screenshots showed, so I matched it exactly
            rather than "fixing" it to a pattern that might not match
            wherever these links actually get clicked from in your UI. */}
        <Route path="admin/demo-data" element={
          <RequireAuth minRole="principal"><DemoDataGenerator /></RequireAuth>
        } />
        <Route path="admin/document-verification" element={
          <RequireAuth minRole="principal"><DocumentVerification /></RequireAuth>
        } />
        <Route path="admin/staff-retention" element={
          <RequireAuth minRole="principal"><StaffRetention /></RequireAuth>
        } />
        <Route path="admin/accreditation" element={
          <RequireAuth minRole="principal"><AccreditationPortfolio /></RequireAuth>
        } />
        <Route path="admin/compliance" element={
          <RequireAuth minRole="principal"><ComplianceReports /></RequireAuth>
        } />
        <Route path="safety-incidents" element={
          <RequireAuth minRole="principal"><SafetyIncidents /></RequireAuth>
        } />
        <Route path="admin/finance" element={
          <RequireAuth minRole="principal"><FinancePage /></RequireAuth>
        } />

        {/* Classroom - Google-Classroom-equivalent, open to all authenticated
            roles (teacher, principal/owner, student, parent); the page
            itself adapts by role via useAuth(). */}
        <Route path="classroom" element={<ClassroomPage />} />

        {/* My Account - change password. Open to any authenticated role;
            the sidebar's user block (avatar/name) links here for everyone,
            since accounts created with a one-time temp password otherwise
            had no way to set their own. */}
        <Route path="account" element={<AccountPage />} />


        {/* Unified Parents & Pupils/Students page - roster, portal
            account creation, and parent-child linking under one page/nav
            entry. Gated at minRole="teacher" (the loosest of the three
            tabs' original requirements, matching Roster/Parents) since
            the stricter Accounts-tab actions are already enforced
            server-side (IsPrincipalOrAbove) regardless of what this
            route allows - narrowing the route itself to "principal" would
            wrongly block teachers from the Roster/Parents tabs they could
            already see before this merge. */}
        <Route path="admin/people" element={
          <RequireAuth minRole="teacher"><PeopleAccountsPage /></RequireAuth>
        } />

        {/* Redirects from the old separate pages this replaced - kept as
            routes (not deleted) so any existing bookmark or internal
            link still lands correctly, just on the matching tab. */}
        <Route path="admin/portal-accounts" element={<Navigate to="/admin/people?tab=accounts" replace />} />
        <Route path="admin/parents" element={<Navigate to="/admin/people?tab=parents" replace />} />

        {/* Registrar Databank - search/profile viewing is teacher+ (same
            floor as Students/Parents already use); document upload/
            delete is gated server-side to registrar-tier+, the page
            itself just hides those controls for anyone below that. */}
        <Route path="admin/registrar" element={
          <RequireAuth minRole="teacher"><RegistrarDatabankPage /></RequireAuth>
        } />

        {/* PTA Portal is parent-facing by definition (Parent-Teacher
            Association) - locking it to minRole="principal" like the
            admin pages above would incorrectly block parents from their
            own portal. Login-only for now; tighten to a parent-specific
            role if RequireAuth supports checking for that. */}
        <Route path="pta" element={
          <RequireAuth><PTAPortal /></RequireAuth>
        } />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <InstallPrompt />
    </>
  )
}
