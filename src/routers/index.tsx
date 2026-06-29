import { Alert } from 'antd';
import { observer } from 'mobx-react-lite';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';

import { AppLoadingState } from '../components/AppState/AppLoadingState.tsx';
import { WorldcupDataProvider } from '../context/WorldcupDataContext.tsx';
import MainLayout from '../layouts/MainLayout/MainLayout.tsx';
import { DashboardPage } from '../pages/user/dashboard/DashboardPage.tsx';
import { HomePage } from '../pages/user/homepage/HomePage.tsx';
import { LeaderboardPage } from '../pages/user/leaderboard/LeaderboardPage.tsx';
import { LoginPage } from '../pages/auth/LoginPage.tsx';
import { MatchListPage } from '../pages/user/matchlist/MatchListPage.tsx';
import { PlayerListPage } from '../pages/user/playerlist/PlayerListPage.tsx';
import { RegisterPage } from '../pages/auth/RegisterPage.tsx';
import { ProfilePage } from '../pages/user/profileUser/ProfilePage.tsx';
import { authStore } from '../store/authStore.ts';
import { EditProfilePage } from '../pages/user/profileUser/EditProfilePage.tsx';

const ProtectedRoute = observer(function ProtectedRoute() {
  if (authStore.status === 'checking') {
    return <AppLoadingState message="Đang kiểm tra quyền truy cập..." />;
  }

  if (!authStore.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
});

const PublicRoute = observer(function PublicRoute() {
  if (authStore.status === 'checking') {
    return <AppLoadingState message="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (authStore.isAuthenticated()) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
});

const ProtectedDataRoute = observer(function ProtectedDataRoute() {
  return (
    <WorldcupDataProvider>
      <Outlet />
    </WorldcupDataProvider>
  );
});

export const routers = createBrowserRouter([
  {
    element: <PublicRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ProtectedDataRoute />,
        children: [
          {
            path: '/',
            element: <MainLayout />,
            children: [
              {
                index: true,
                element: <HomePage />,
              },
              {
                path: 'leaderboard',
                element: <LeaderboardPage />,
              },
              {
                path: 'list',
                element: <PlayerListPage />,
              },
              {
                path: 'dashboard',
                element: <DashboardPage />,
              },
              {
                path: 'matches',
                element: <MatchListPage />,
              },
              {
                path: 'profile',
                element: <ProfilePage />,
              },
              {
                path: 'profile/edit',
                element: <EditProfilePage />,
              },
              {
                path: 'editprofile',
                element: <Navigate to="/profile/edit" replace />,
              },
              {
                path: '*',
                element: <Alert type="warning" message="Trang không tồn tại" showIcon />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
