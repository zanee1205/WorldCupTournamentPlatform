import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useLocation } from 'react-router-dom';
import { Button, Drawer, Layout, Menu } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

import NotificationBell from '../components/NotificationSide/NotificationBell.tsx';
import styles from '../App.module.scss';
import logo from '../assets/logo.png';
import { useBreakpoint } from '../hooks/useViewport.ts';
import { appStore } from '../store/matchStore.ts';

const { Header } = Layout;

export const AppHeader = observer(function AppHeader() {
  const location = useLocation();
  const summary = appStore.summary;
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith('/dashboard')) return 'dashboard';
    if (location.pathname.startsWith('/leaderboard')) return 'leaderboard';
    if (location.pathname.startsWith('/list')) return 'list';
    return 'home';
  }, [location.pathname]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useBreakpoint(768);

  if (!summary) {
    return null;
  }

  const navItems = useMemo(
    () => [
      { key: 'home', label: <Link to="/">Homepage</Link> },
      { key: 'leaderboard', label: <Link to="/leaderboard">Leaderboard</Link> },
      { key: 'list', label: <Link style={{ padding: '0 35px ' }} to="/list">List</Link> },
      { key: 'dashboard', label: <Link to="/dashboard">Dashboard</Link> },
      { key: 'matches', label: <Link to="/matches">Matches</Link> },
    ],
    [],
  );

  return (
    <Header className={styles.appHeader}>
      <div className={styles.brand}>
        <img src={logo} alt="logo" className={styles.brandMark} />
        <span className={styles.brandText}>Tournament Platform</span>
      </div>

      {isMobile ? (
        <Button
          type="text"
          className={styles.mobileMenuBtn}
          icon={<MenuOutlined style={{ color: '#fff', fontSize: 20 }} />}
          onClick={() => setMobileOpen(true)}
        />
      ) : null}

      {!isMobile ? (
        <Menu
          style={{ flex: 1, justifyContent: 'flex-end', minWidth: 300 }}
          theme="dark"
          mode="horizontal"
          selectedKeys={[selectedKey]}
          items={navItems}
        />
      ) : null}

      <div className={styles.headerActions}>
        <NotificationBell />
      </div>

      <Drawer
        title={null}
        placement="right"
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        bodyStyle={{ padding: 0 }}
      >
        <Menu
          mode="inline"
          theme="dark"
          selectedKeys={[selectedKey]}
          items={navItems}
          onClick={() => setMobileOpen(false)}
        />
      </Drawer>
    </Header>
  );
});
