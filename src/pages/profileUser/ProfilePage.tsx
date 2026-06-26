import { Avatar, Button, Card, Col, Row, Tag, Typography } from 'antd';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

import { authStore } from '../../store/authStore.ts';
import styles from './ProfilePage.module.scss';

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
  if (!value) {
    return 'Chưa cập nhật';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Chưa cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export const ProfilePage = observer(function ProfilePage() {
  const navigate = useNavigate();
  const user = authStore.user;

  if (!user) {
    return null;
  }

  const displayName = user.fullName?.trim() || user.account || user.email || 'Người dùng';
  const avatarInitials = getInitials(displayName);

  return (
    <div className={styles.profilePage}>
      <div className={styles.pageInner}>
        <div className={styles.pageHeading}>
          <div>
            <Typography.Text className={styles.eyebrow}>Tournament Platform</Typography.Text>
            <Typography.Title level={2} className={styles.title}>
              Hồ sơ cá nhân
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              Xem nhanh thông tin tài khoản của bạn và mở trang chỉnh sửa khi cần cập nhật avatar, họ tên hoặc số điện thoại.
            </Typography.Paragraph>
          </div>
          <Tag color="geekblue" className={styles.liveTag}>
            Đang hoạt động
          </Tag>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24}>
            <Card className={styles.summaryCard} bordered={false}>
              <div className={styles.avatarShell}>
                <div className={styles.avatarFrame}>
                  {user.avatar ? (
                    <Avatar src={user.avatar} size={96} className={styles.avatar} />
                  ) : (
                    <Avatar size={96} className={`${styles.avatar} ${styles.avatarFallback}`}>
                      {avatarInitials || 'U'}
                    </Avatar>
                  )}
                </div>
              </div>

              <div className={styles.profileIdentity}>
                <Typography.Title level={3} className={styles.displayName}>
                  {displayName}
                </Typography.Title>
                <Typography.Text className={styles.accountName}>@{user.account}</Typography.Text>
                <Typography.Paragraph className={styles.identityText}>
                  {user.email}
                </Typography.Paragraph>
              </div>

              <div className={styles.miniStats}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Họ tên</span>
                  <strong className={styles.statValue}>{user.fullName?.trim() || 'Chưa cập nhật'}</strong>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Số điện thoại</span>
                  <strong className={styles.statValue}>{user.phoneNumber?.trim() || 'Chưa cập nhật'}</strong>
                </div>
              </div>

              <div className={styles.metaList}>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tài khoản</span>
                  <span className={styles.metaValue}>{user.account}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Email</span>
                  <span className={styles.metaValue}>{user.email}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Cập nhật cuối</span>
                  <span className={styles.metaValue}>{formatDateTime(user.updatedAt)}</span>
                </div>
                <div className={styles.metaRow}>
                  <span className={styles.metaLabel}>Tạo lúc</span>
                  <span className={styles.metaValue}>{formatDateTime(user.createdAt)}</span>
                </div>
              </div>

              <div className={styles.infoHeader}>
                <div>
                  <Typography.Title level={4} className={styles.sectionTitle}>
                    Tổng quan tài khoản
                  </Typography.Title>
                  <Typography.Text className={styles.sectionSubtitle}>
                    Thông tin này đang được dùng ở header và các màn bảo vệ quyền truy cập.
                  </Typography.Text>
                </div>
              </div>

              <div className={styles.infoGrid}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Mã tài khoản</span>
                  <strong className={styles.infoValue}>@{user.account}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Tên hiển thị</span>
                  <strong className={styles.infoValue}>{displayName}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Email</span>
                  <strong className={styles.infoValue}>{user.email}</strong>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Số điện thoại</span>
                  <strong className={styles.infoValue}>{user.phoneNumber?.trim() || 'Chưa cập nhật'}</strong>
                </div>
              </div>

              <Button
                type="primary"
                size="large"
                block
                className={styles.editButton}
                onClick={() => {
                  navigate('/profile/edit');
                }}
                >
                  Chỉnh sửa hồ sơ
                </Button>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
});
