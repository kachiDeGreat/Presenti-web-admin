import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthPage } from "./pages/AuthPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SetupPage } from "./pages/SetupPage";
import { BeaconSettingsPage } from "./pages/BeaconSettingsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { MembersPage } from "./pages/MembersPage";
import { RouteProgressBar } from "./components/common/RouteProgressBar";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <RouteProgressBar />
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<Navigate to="/login" replace />} />

          {/* Protected Step-by-Step Onboarding */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingPage />
              </ProtectedRoute>
            }
          />

          {/* Protected Administrative Suite */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="settings/beacon" element={<BeaconSettingsPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="users" element={<Navigate to="/members" replace />} />
            <Route path="setup" element={<SetupPage />} />
            <Route path="reports" element={<ReportsPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>

      {/* Global Toast Container: Top-Center, Colored, No Progress Bar */}
      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
    </AuthProvider>
  );
};

export default App;
