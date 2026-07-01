import { useMemo, useState } from 'react';
import { Button, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
    DesktopOutlined,
    MailOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    PieChartOutlined,
    UserOutlined,
    CheckCircleOutlined,
    QuestionCircleOutlined
} from '@ant-design/icons';
import { observer } from 'mobx-react-lite';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import styles from './AdminLayout.module.scss';
import { authStore } from '../../store/authStore.ts';

import logo from '../../assets/logo.png';

const { Header, Content, Sider } = Layout;

export default observer(function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const accountName = authStore.user?.fullName || authStore.user?.account || authStore.user?.email || 'Tài khoản';

    const menuItems = useMemo<MenuProps['items']>(
        () => [
            { key: '/admin', icon: <PieChartOutlined />, label: 'Tổng quan' },
            { key: '/admin/dashboard', icon: <DesktopOutlined />, label: 'Dashboard' },
            { key: '/admin/accounts', icon: <MailOutlined />, label: 'Quản lý tài khoản' },
            { key: '/admin/profile', icon: <UserOutlined />, label: 'Hồ sơ admin' },
            { key: '/admin/changePassword', icon: <CheckCircleOutlined />, label: 'Duyệt đổi mật khẩu' },
            { key: '/admin/unlock-requests', icon: <QuestionCircleOutlined />, label: 'Duyệt yêu cầu mở khóa' },
        ],
        [],
    );

    const handleMenuClick = ({ key }: { key: string }) => {
        if (key) {
            navigate(key);
        }
    };

    const selectedKeys = [
        location.pathname === '/admin'
            ? '/admin'
            : location.pathname.startsWith('/admin/dashboard')
                ? '/admin/dashboard'
                : location.pathname.startsWith('/admin/accounts')
                    ? '/admin/accounts'
                    : location.pathname.startsWith('/admin/changePassword')
                        ? '/admin/changePassword'
                        : location.pathname.startsWith('/admin/unlock-requests')
                            ? '/admin/unlock-requests'
                            : location.pathname.startsWith('/admin/profile')
                                ? '/admin/profile'
                                : '',
    ];

    return (
        <Layout className={styles.adminLayout}>
            <Header className={styles.adminHeader}>
                <div className={styles.headerBrand}>
                    <img src={logo} alt="logo" className={styles.brandMark} />
                    <Typography.Title level={4} className={styles.headerTitle}>Tournament Platform</Typography.Title>
                </div>

                <div className={styles.headerActions}>
                    <span className={styles.headerSubtitle}>
                        Welcome back, <span style={{ color: '#fcd34d' }}><b>{accountName}</b></span> !
                    </span>
                    <Button type="primary" danger onClick={() => void authStore.logout()}>
                        Đăng xuất
                    </Button>
                </div>
            </Header>

            <Layout className={styles.adminWrapper}>
                <Sider collapsible collapsed={collapsed} trigger={null} width={256} className={styles.adminSider}>
                    <div className={styles.siderHeader}>
                        <Button type="text" onClick={() => setCollapsed((prev) => !prev)}>
                            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                        </Button>
                    </div>
                    <Menu
                        mode="inline"
                        theme="dark"
                        inlineCollapsed={collapsed}
                        selectedKeys={selectedKeys}
                        items={menuItems}
                        onClick={handleMenuClick}
                    />
                </Sider>

                <Content className={styles.adminContent}>
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
});
