import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { adminQueryRetry, adminRetryDelay } from './api/retry';
import { RequirePermission, RequireSession, SessionBridge } from './auth/AdminSession';
import { NotFoundNotice } from './components/ui';
import { AiPage } from './pages/AiPage';
import { AuditPage } from './pages/AuditPage';
import { BillingPage } from './pages/BillingPage';
import { HouseholdsPage, UsersPage } from './pages/UsersPage';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { RecipeDetailPage } from './pages/RecipeDetailPage';
import { RecipesPage } from './pages/RecipesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SystemPage } from './pages/SystemPage';
import { UserDetailPage } from './pages/UserDetailPage';

export function createAdminQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: false, retry: adminQueryRetry, retryDelay: adminRetryDelay },
      // Sensitive mutations are never retried automatically.
      mutations: { retry: false },
    },
  });
}

export function AdminApp({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <SessionBridge />
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<RequireSession />}>
            <Route
              index
              element={
                <RequirePermission permission="overview.read">
                  <OverviewPage />
                </RequirePermission>
              }
            />
            <Route
              path="users"
              element={
                <RequirePermission permission="users.read">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="users/:userId"
              element={
                <RequirePermission permission="users.read">
                  <UserDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="households"
              element={
                <RequirePermission permission="households.read">
                  <HouseholdsPage />
                </RequirePermission>
              }
            />
            <Route
              path="billing"
              element={
                <RequirePermission permission="billing.read">
                  <BillingPage />
                </RequirePermission>
              }
            />
            <Route
              path="ai"
              element={
                <RequirePermission permission="ai.read">
                  <AiPage />
                </RequirePermission>
              }
            />
            <Route
              path="recipes"
              element={
                <RequirePermission permission="recipes.read">
                  <RecipesPage />
                </RequirePermission>
              }
            />
            <Route
              path="recipes/:recipeId"
              element={
                <RequirePermission permission="recipes.read">
                  <RecipeDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="system"
              element={
                <RequirePermission permission="system.read">
                  <SystemPage />
                </RequirePermission>
              }
            />
            <Route
              path="audit"
              element={
                <RequirePermission permission="audit.read">
                  <AuditPage />
                </RequirePermission>
              }
            />
            <Route
              path="settings"
              element={
                <RequirePermission permission="admin.self.read">
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route path="*" element={<NotFoundNotice />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
