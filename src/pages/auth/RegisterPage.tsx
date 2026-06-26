import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';

import { authStore } from '../../store/authStore.ts';
import styles from './AuthPage.module.scss';

type RegisterFormValues = {
  account: string;
  email: string;
  password: string;
  confirmPassword: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Không thể đăng ký.';
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className={styles.authPage}>
      <Card className={styles.authCard} bordered={false}>
        <div className={styles.authHeader}>
          <Typography.Text className={styles.authSubtitle}>Tournament Platform</Typography.Text>
          <div className={styles.authTitle}>Đăng ký</div>
          <Typography.Paragraph className={styles.authSubtitle}>
            Tạo tài khoản mới để bắt đầu tham gia dự đoán.
          </Typography.Paragraph>
        </div>

        <Form<RegisterFormValues>
          layout="vertical"
          requiredMark={false}
          onFinish={async (values) => {
            setSubmitting(true);
            try {
              await authStore.register({
                account: values.account,
                email: values.email,
                password: values.password,
              });
              message.success('Đăng ký thành công.');
              navigate('/', { replace: true });
            } catch (error) {
              message.error(getErrorMessage(error));
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Form.Item
            label="Tài khoản"
            name="account"
            rules={[{ required: true, message: 'Vui lòng nhập tài khoản.' }]}
          >
            <Input autoComplete="username" placeholder="Nhập tài khoản" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email.' },
              { type: 'email', message: 'Email không hợp lệ.' },
            ]}
          >
            <Input autoComplete="email" placeholder="Nhập email" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu.' }, { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự.' }]}
          >
            <Input.Password autoComplete="new-password" placeholder="Nhập mật khẩu" />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu.' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp.'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" placeholder="Nhập lại mật khẩu" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block loading={submitting}>
            Tạo tài khoản
          </Button>
        </Form>

        <div className={styles.authLinkRow}>
          <Typography.Text className={styles.authSubtitle}>Đã có tài khoản?</Typography.Text>
          <Link to="/login">Đăng nhập</Link>
        </div>
      </Card>
    </div>
  );
}
