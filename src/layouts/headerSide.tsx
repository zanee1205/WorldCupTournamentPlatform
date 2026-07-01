import { useMemo } from 'react';
import type { MenuProps } from 'antd';
import { Avatar, Button, Dropdown, Layout, Space } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

import styles from './headerSide.module.scss';
import logo from '../assets/logo.png';
import { appStore } from '../store/matchStore.ts';
import { authStore } from '../store/authStore.ts';

import { Link } from 'react-router-dom';

const { Header } = Layout;

export const AppHeader = observer(function AppHeader() {
  const navigate = useNavigate();
  const summary = appStore.summary;
  const accountName = authStore.user?.fullName || authStore.user?.account || authStore.user?.email || 'Tài khoản';
  const accountAvatar = authStore.user?.avatar?.trim() || '';
  const accountInitials = accountName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  const accountMenuItems = useMemo<MenuProps['items']>(
    () => {
      const items: MenuProps['items'] = [
        { key: 'home', label: 'Homepage' },
        { key: 'leaderboard', label: 'Leaderboard' },
        { key: 'list', label: 'Player list' },
        { key: 'dashboard', label: 'Dashboard' },
        { key: 'matches', label: 'Matches' },
      ];

      if (authStore.user?.role === 'user') {
        items.push({ type: 'divider' }, { key: 'passwordChange', label: 'Đổi mật khẩu' });
      }

      if (authStore.user?.role === 'admin') {
        items.push({ type: 'divider' }, { key: 'admin', label: 'Trang quản trị' });
      }

      items.push({ key: 'profile', label: 'Your Profile' }, { type: 'divider' }, { key: 'logout', danger: true, label: 'Đăng xuất' });
      return items;
    },
    [authStore.user?.role],
  );

  const handleAccountMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      void authStore.logout();
      return;
    }

    const routes: Record<string, string> = {
      home: '/',
      leaderboard: '/leaderboard',
      list: '/list',
      dashboard: '/dashboard',
      matches: '/matches',
      passwordChange: '/password-changing',
      admin: '/admin',
      profile: '/profile',
    };

    const targetRoute = routes[key];
    if (targetRoute) {
      navigate(targetRoute);
    }
  };

  if (!summary) {
    return null;
  }

  return (
    <Header className={styles.appHeader}>
      <div className={styles.brand}>
        <img src={logo} alt="logo" className={styles.brandMark} />
        <Link to="/" className={styles.brandLink}>
          <span className={styles.brandText}>Tournament Platform</span>
        </Link>
      </div>

      <div className={styles.headerActions}>
        <Dropdown menu={{ items: accountMenuItems, onClick: handleAccountMenuClick }} trigger={['click']} placement="bottomRight">
          <Button type="text" className={styles.accountButton}>
            <Space size={8} align="center">
              <Avatar src={accountAvatar || undefined} size={28} className={styles.accountAvatar}>
                {!accountAvatar ? accountInitials : null}
              </Avatar>
              <span className={styles.accountName}>
                Welcome back, <span style={{ color: '#fcd34d' }}><b>{accountName}</b></span> !
              </span>
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
});
