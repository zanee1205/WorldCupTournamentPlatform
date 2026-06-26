import { useMemo } from 'react';
import type { MenuProps } from 'antd';
import { Button, Dropdown, Layout, Space } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

import styles from './headerSide.module.scss';
import logo from '../assets/logo.png';
import { appStore } from '../store/matchStore.ts';
import { authStore } from '../store/authStore.ts';

const { Header } = Layout;

export const AppHeader = observer(function AppHeader() {
  const navigate = useNavigate();
  const summary = appStore.summary;
  const accountName = authStore.user?.account || authStore.user?.email || 'Tài khoản';

  const accountMenuItems = useMemo<MenuProps['items']>(
    () => [
      { key: 'home', label: 'Homepage' },
      { key: 'leaderboard', label: 'Leaderboard' },
      { key: 'list', label: 'List' },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'matches', label: 'Matches' },
      { type: 'divider' },
      { key: 'logout', danger: true, label: 'Đăng xuất' },
    ],
    [],
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
        <span className={styles.brandText}>Tournament Platform</span>
      </div>

      <div className={styles.headerActions}>
        <Dropdown menu={{ items: accountMenuItems, onClick: handleAccountMenuClick }} trigger={['click']} placement="bottomRight">
          <Button type="text" className={styles.accountButton}>
            <Space size={8} align="center">
              <span className={styles.accountName}>
                Welcome back, <span style={{ color: '#fcd34d' }}> <b>{accountName}</b> </span> !
              </span>
              <DownOutlined />
            </Space>
          </Button>
        </Dropdown>
      </div>
    </Header>
  );
});
