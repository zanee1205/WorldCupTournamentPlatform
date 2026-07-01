import { Alert, Modal } from 'antd';
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
import { PasswordChangingPage } from '../pages/user/passwordChange/PasswordChangingPage.tsx';
import AdminLayout from '../layouts/AdminLayout/AdminLayout';
import { AdminHomePage } from '../pages/admin/homepage/AdminHomePage.tsx';
import { AdminDashboardPage } from '../pages/admin/dashboard/DashboardPage.tsx';
import { ManagingAccountPage } from '../pages/admin/managingAccount/ManagingAccountPage.tsx';
import { PasswordChangingRequestPage } from '../pages/admin/changePasswordRequest/PasswordChangingRequestPage.tsx';
import { UnlockRequestPage as AdminUnlockRequestPage } from '../pages/admin/unlockRequest/UnlockRequestPage';
import { ProfileAdminPage } from '../pages/admin/profileAdmin/ProfileAdminPage.tsx';

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

let isShowingRoleModal = false;

function showRoleModal(message: string) {
  if (isShowingRoleModal) return;
  isShowingRoleModal = true;
  Modal.warning({
    title: 'Không đủ quyền truy cập',
    content: message,
    okText: 'Đã hiểu',
    onOk: () => {
      isShowingRoleModal = false;
    },
    onCancel: () => {
      isShowingRoleModal = false;
    },
  });
}

const AdminRoute = observer(function AdminRoute() {
  if (authStore.status === 'checking') {
    return <AppLoadingState message="Đang kiểm tra quyền truy cập..." />;
  }

  if (!authStore.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (authStore.user?.role !== 'admin') {
    showRoleModal('Bạn không có quyền truy cập trang quản trị.');
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
});

const UserRoute = observer(function UserRoute() {
  if (authStore.status === 'checking') {
    return <AppLoadingState message="Đang kiểm tra quyền truy cập..." />;
  }

  if (!authStore.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (authStore.user?.role !== 'user') {
    showRoleModal('Tài khoản admin không được truy cập khu vực người dùng.');
    return <Navigate to="/admin" replace />;
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
            element: <UserRoute />,
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
                    path: 'password-changing',
                    element: <PasswordChangingPage />,
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
          {
            element: <AdminRoute />,
            children: [
              {
                path: '/admin',
                element: <AdminLayout />,
                children: [
                  {
                    index: true,
                    element: <AdminHomePage />,
                  },
                  {
                    path: 'dashboard',
                    element: <AdminDashboardPage />,
                  },
                  {
                    path: 'accounts',
                    element: <ManagingAccountPage />,
                  },
                  {
                    path: 'changePassword',
                    element: <PasswordChangingRequestPage />,
                  },
                  {
                    path: 'unlock-requests',
                    element: <AdminUnlockRequestPage />,
                  },
                  {
                    path: 'profile',
                    element: <ProfileAdminPage />,
                  },
                ],
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
