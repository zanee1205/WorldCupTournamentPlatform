import { Avatar, Button, Card, Col, Row, Tag, Typography, message } from 'antd';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { authStore } from '../../../store/authStore.ts';
import { getAuthSession } from '../../../services/apiService.ts';
import type { AuthUser } from '../../../types/auth.ts';
import { AppLoadingState } from '../../../components/AppState/AppLoadingState.tsx';
import styles from './ProfileAdminPage.module.scss';

function getInitials(value: string) {
    return value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function formatDateTime(value?: string) {
    if (!value) return 'Chưa cập nhật';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
    return new Intl.DateTimeFormat('vi-VN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export const ProfileAdminPage = observer(function ProfileAdminPage() {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<AuthUser | null>(authStore.user);
    const [loading, setLoading] = useState(!authStore.user);

    useEffect(() => {
        let active = true;

        const loadProfile = async () => {
            setLoading(true);
            try {
                const session = await getAuthSession();
                if (!active) return;
                setProfile(session.user);
            } catch (error) {
                if (error && typeof error === 'object' && 'response' in error) {
                    const response = (error as { response?: { status?: number } }).response;
                    if (response?.status === 401) {
                        authStore.markUnauthenticated('profile_invalid_token');
                        navigate('/login', { replace: true });
                        return;
                    }
                }
                message.error('Không thể tải thông tin hồ sơ admin.');
            } finally {
                if (active) setLoading(false);
            }
        };

        void loadProfile();

        return () => {
            active = false;
        };
    }, [navigate]);

    if (loading) {
        return <AppLoadingState message="Đang tải hồ sơ admin..." />;
    }

    if (!profile) {
        return null;
    }

    const displayName = profile.fullName?.trim() || profile.account || profile.email || 'Quản trị viên';
    const avatarInitials = getInitials(displayName);

    return (
        <div className={styles.profilePage}>
            <div className={styles.pageInner}>
                <div className={styles.pageHeading}>
                    <div>
                        <Typography.Text className={styles.eyebrow}>Admin Control</Typography.Text>
                        <Typography.Title level={2} className={styles.title}>Hồ sơ quản trị viên</Typography.Title>
                        <Typography.Paragraph className={styles.subtitle}>
                            Thông tin tài khoản quản trị viên được hiển thị ở đây dưới dạng chỉ đọc. Mọi thay đổi thông tin phải được thực hiện qua kênh quản trị hoặc hệ thống riêng.
                        </Typography.Paragraph>
                    </div>
                    <Tag color="geekblue" className={styles.liveTag}>Quyền admin</Tag>
                </div>

                <Row gutter={[24, 24]}>
                    <Col xs={24}>
                        <Card className={styles.summaryCard} bordered={false}>
                            <div className={styles.avatarShell}>
                                <div className={styles.avatarFrame}>
                                    {profile.avatar ? (
                                        <Avatar src={profile.avatar} size={96} className={styles.avatar} />
                                    ) : (
                                        <Avatar size={96} className={`${styles.avatar} ${styles.avatarFallback}`}>
                                            {avatarInitials || 'A'}
                                        </Avatar>
                                    )}
                                </div>
                            </div>

                            <div className={styles.profileIdentity}>
                                <Typography.Title level={3} className={styles.displayName}>{displayName}</Typography.Title>
                                <Typography.Text className={styles.accountName}>@{profile.account}</Typography.Text>
                                <Typography.Paragraph className={styles.identityText}>{profile.email}</Typography.Paragraph>
                            </div>

                            <div className={styles.miniStats}>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Họ tên</span>
                                    <strong className={styles.statValue}>{profile.fullName?.trim() || 'Chưa cập nhật'}</strong>
                                </div>
                                <div className={styles.statCard}>
                                    <span className={styles.statLabel}>Số điện thoại</span>
                                    <strong className={styles.statValue}>{profile.phoneNumber?.trim() || 'Chưa cập nhật'}</strong>
                                </div>
                            </div>

                            <div className={styles.metaList}>
                                <div className={styles.metaRow}>
                                    <span className={styles.metaLabel}>Tài khoản</span>
                                    <span className={styles.metaValue}>{profile.account}</span>
                                </div>
                                <div className={styles.metaRow}>
                                    <span className={styles.metaLabel}>Email</span>
                                    <span className={styles.metaValue}>{profile.email}</span>
                                </div>
                                <div className={styles.metaRow}>
                                    <span className={styles.metaLabel}>Vai trò</span>
                                    <span className={styles.metaValue}>{profile.role}</span>
                                </div>
                                <div className={styles.metaRow}>
                                    <span className={styles.metaLabel}>Cập nhật cuối</span>
                                    <span className={styles.metaValue}>{formatDateTime(profile.updatedAt)}</span>
                                </div>
                                <div className={styles.metaRow}>
                                    <span className={styles.metaLabel}>Tạo lúc</span>
                                    <span className={styles.metaValue}>{formatDateTime(profile.createdAt)}</span>
                                </div>
                            </div>

                            <div className={styles.actionRow}>
                                <Button type="primary" size="middle" onClick={() => navigate('/admin')}>
                                    Quay về trang quản trị
                                </Button>
                            </div>
                        </Card>
                    </Col>
                </Row>
            </div>
        </div>
    );
});
