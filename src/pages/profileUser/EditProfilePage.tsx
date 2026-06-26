import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Avatar, Button, Card, Col, Form, Input, Row, Space, Tag, Typography, message } from 'antd';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

import { authStore } from '../../store/authStore.ts';
import type { AuthProfileUpdateInput } from '../../types/auth.ts';
import type { ProfileFormValues } from '../../types/profileFormValue.ts';
import styles from './EditProfilePage.module.scss';

function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Không thể xử lý ảnh đã chọn.'));
    image.src = source;
  });
}

async function compressImageFile(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(objectUrl);
    const maxSize = 640;
    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Không thể xử lý ảnh đã chọn.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const EditProfilePage = observer(function EditProfilePage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<ProfileFormValues>();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const initialAvatarRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const user = authStore.user;
  const watchedAvatar = Form.useWatch('avatar', form);

  useEffect(() => {
    const normalizedAvatar = user?.avatar?.trim() || null;
    initialAvatarRef.current = normalizedAvatar;

    form.setFieldsValue({
      avatar: normalizedAvatar ?? undefined,
      fullName: user?.fullName ?? undefined,
      phoneNumber: user?.phoneNumber ?? undefined,
    });
  }, [form, user]);

  const displayName = useMemo(
    () => user?.fullName?.trim() || user?.account || user?.email || 'Người dùng',
    [user?.account, user?.email, user?.fullName],
  );

  const avatarValue =
    watchedAvatar === undefined
      ? user?.avatar?.trim() ?? null
      : typeof watchedAvatar === 'string'
        ? watchedAvatar.trim()
        : watchedAvatar;
  const avatarInitials = getInitials(displayName);

  const openAvatarPicker = () => {
    avatarInputRef.current?.click();
  };

  const clearAvatar = () => {
    form.setFieldsValue({ avatar: null });
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn một file ảnh hợp lệ.');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      message.error('Ảnh quá lớn. Vui lòng chọn file nhỏ hơn 8MB.');
      return;
    }

    setUploadingAvatar(true);

    try {
      const dataUrl = await compressImageFile(file);
      form.setFieldsValue({ avatar: dataUrl });
      message.success(`Đã tải và nén ảnh ${file.name}.`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Không thể tải ảnh lên.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className={styles.editPage}>
      <div className={styles.pageInner}>
        <div className={styles.pageHeading}>
          <div>
            <Typography.Text className={styles.eyebrow}>Tournament Platform</Typography.Text>
            <Typography.Title level={2} className={styles.title}>
              Chỉnh sửa hồ sơ
            </Typography.Title>
            <Typography.Paragraph className={styles.subtitle}>
              Cập nhật avatar, họ tên và số điện thoại cho tài khoản của bạn.
            </Typography.Paragraph>
          </div>
          <Space wrap>
            <Tag color="geekblue" className={styles.liveTag}>
              Đang hoạt động
            </Tag>
            <Button onClick={() => navigate('/profile')}>Xem hồ sơ</Button>
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={9}>
            <Card className={styles.summaryCard} bordered={false}>
              <div className={styles.avatarShell}>
                <div className={styles.avatarFrame}>
                  {avatarValue ? (
                    <Avatar src={avatarValue} size={96} className={styles.avatar} />
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
            </Card>
          </Col>

          <Col xs={24} lg={15}>
            <Card className={styles.formCard} bordered={false}>
              <div className={styles.formHeader}>
                <div>
                  <Typography.Title level={4} className={styles.sectionTitle}>
                    Thông tin cá nhân
                  </Typography.Title>
                  <Typography.Text className={styles.sectionSubtitle}>
                    Những thay đổi này sẽ được phản ánh ngay lên header và trang hồ sơ.
                  </Typography.Text>
                </div>
              </div>

              <Form<ProfileFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                className={styles.profileForm}
                onFinish={async (values) => {
                  setSubmitting(true);
                  try {
                    const nextAvatar = values.avatar?.trim() || null;
                    const payload: AuthProfileUpdateInput = {
                      fullName: values.fullName?.trim() || null,
                      phoneNumber: values.phoneNumber?.trim() || null,
                    };

                    if (nextAvatar !== initialAvatarRef.current) {
                      payload.avatar = nextAvatar;
                    }

                    await authStore.updateProfile(payload);
                    message.success('Đã cập nhật hồ sơ.');
                    navigate('/profile');
                  } catch (error) {
                    message.error(error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                initialValues={{
                  avatar: user.avatar ?? undefined,
                  fullName: user.fullName ?? undefined,
                  phoneNumber: user.phoneNumber ?? undefined,
                }}
              >
                <Form.Item name="avatar" hidden>
                  <Input />
                </Form.Item>

                <Form.Item
                  label="Avatar"
                  extra="Tải ảnh từ máy tính lên. Ảnh sẽ tự được nén trước khi lưu."
                >
                  <div className={styles.avatarUploadCard}>
                    <div className={styles.avatarUploadPreview}>
                      {avatarValue ? (
                        <Avatar src={avatarValue} size={88} className={styles.avatar} />
                      ) : (
                        <Avatar size={88} className={`${styles.avatar} ${styles.avatarFallback}`}>
                          {avatarInitials || 'U'}
                        </Avatar>
                      )}
                    </div>

                    <div className={styles.avatarUploadMeta}>
                      <Typography.Text className={styles.uploadTitle}>
                        {avatarValue ? 'Đã có ảnh đại diện' : 'Chưa có ảnh đại diện'}
                      </Typography.Text>
                      <Typography.Paragraph className={styles.uploadDescription}>
                        Chọn file PNG, JPG hoặc WebP từ thiết bị của bạn. Hệ thống sẽ nén ảnh
                        trước khi gửi để tránh lỗi payload quá lớn.
                      </Typography.Paragraph>

                      <Space wrap>
                        <Button onClick={openAvatarPicker} loading={uploadingAvatar}>
                          Tải ảnh lên
                        </Button>
                        <Button onClick={clearAvatar} disabled={!avatarValue}>
                          Xóa ảnh
                        </Button>
                      </Space>
                    </div>

                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleAvatarChange}
                    />
                  </div>
                </Form.Item>

                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Họ tên"
                      name="fullName"
                      extra="Tên hiển thị trên header và trang hồ sơ."
                    >
                      <Input size="large" placeholder="Nhập họ tên" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Số điện thoại"
                      name="phoneNumber"
                      extra="Để lại liên hệ khi cần."
                    >
                      <Input size="large" placeholder="Nhập số điện thoại" />
                    </Form.Item>
                  </Col>
                </Row>

                <div className={styles.helperPanel}>
                  <div>
                    <Typography.Text className={styles.helperLabel}>Mẹo nhỏ</Typography.Text>
                    <Typography.Paragraph className={styles.helperText}>
                      Nếu chưa có ảnh, bạn cứ để trống. Hệ thống sẽ dùng tên viết tắt thay thế.
                    </Typography.Paragraph>
                  </div>

                  <div className={styles.actions}>
                    <Button onClick={() => navigate('/profile')}>Hủy</Button>
                    <Button type="primary" htmlType="submit" size="large" loading={submitting}>
                      Lưu thay đổi
                    </Button>
                  </div>
                </div>
              </Form>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
});
