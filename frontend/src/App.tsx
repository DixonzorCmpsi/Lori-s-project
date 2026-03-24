import { Routes, Route } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProductionLayout } from '@/components/layout/ProductionLayout';

// Auth pages
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { VerifyEmailPage } from '@/pages/VerifyEmailPage';
import { JoinPage } from '@/pages/JoinPage';

// Dashboard pages
import { DashboardPage } from '@/pages/DashboardPage';
import { AccountPage } from '@/pages/AccountPage';
import { NewTheaterPage } from '@/pages/NewTheaterPage';
import { NewProductionPage } from '@/pages/NewProductionPage';

// Production pages
import { ProductionDashboardPage } from '@/pages/ProductionDashboardPage';
import { SchedulePage } from '@/pages/SchedulePage';
import { BulletinPage } from '@/pages/BulletinPage';
import { RosterPage } from '@/pages/RosterPage';
import { ChatListPage } from '@/pages/ChatListPage';
import { ChatConversationPage } from '@/pages/ChatConversationPage';
import { ConflictsPage } from '@/pages/ConflictsPage';
import { CastProfilePage } from '@/pages/CastProfilePage';
import { ProductionSettingsPage } from '@/pages/ProductionSettingsPage';

export function App() {
  return (
    <Routes>
      {/* Public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/join" element={<JoinPage />} />
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        {/* Dashboard layout */}
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/theater/new" element={<NewTheaterPage />} />
          <Route path="/production/new" element={<NewProductionPage />} />
        </Route>

        {/* Production layout */}
        <Route path="/production/:id" element={<ProductionLayout />}>
          <Route index element={<ProductionDashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="bulletin" element={<BulletinPage />} />
          <Route path="roster" element={<RosterPage />} />
          <Route path="chat" element={<ChatListPage />} />
          <Route path="chat/:convId" element={<ChatConversationPage />} />
          <Route path="conflicts" element={<ConflictsPage />} />
          <Route path="profile" element={<CastProfilePage />} />
          <Route path="settings" element={<ProductionSettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
