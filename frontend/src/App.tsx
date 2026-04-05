import { Routes, Route } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { BackstageLayout } from '@/components/theater/BackstageLayout';

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

import { NotFoundPage } from '@/pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      {/* Theater experience — login/register get full-screen theater with curtains closed */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Other public auth routes */}
      <Route element={<AuthLayout />}>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/join" element={<JoinPage />} />
      </Route>

      {/* Protected routes — all use the backstage theater layout with curtains open */}
      <Route element={<ProtectedRoute />}>
        {/* Dashboard (no production selected) */}
        <Route element={<BackstageLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/theater/new" element={<NewTheaterPage />} />
          <Route path="/production/new" element={<NewProductionPage />} />
        </Route>

        {/* Production view (production selected — panels show members) */}
        <Route path="/production/:id" element={<BackstageLayout />}>
          <Route index element={<ProductionDashboardPage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="bulletin" element={<BulletinPage />} />
          <Route path="roster" element={<RosterPage />} />
          <Route path="chat" element={<ChatListPage />} />
          <Route path="chat/:convId" element={<ChatConversationPage />} />
          <Route path="conflicts" element={<ConflictsPage />} />
          <Route path="profile" element={<CastProfilePage />} />
          <Route path="settings" element={<ProductionSettingsPage />} />
          <Route path="account" element={<AccountPage />} />
        </Route>
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
