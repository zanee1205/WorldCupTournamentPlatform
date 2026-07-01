import { Button, Card, Form, Input, Typography, message } from 'antd';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import styles from './PasswordChangingPage.module.scss';

import { createPasswordChangeRequest } from '../../../services/apiService.ts';

interface PasswordChangingFormValues {
  newPassword: string;
  confirmPassword: string;
  reason?: string;
}

export const PasswordChangingPage = observer(function PasswordChangingPage() {
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<PasswordChangingFormValues>();

  const handleSubmit = async (values: PasswordChangingFormValues) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSubmitting(true);
    try {
      await createPasswordChangeRequest({ newPassword: values.newPassword, reason: values.reason });
      message.success('Yêu cầu đổi mật khẩu đã được gửi. Vui lòng chờ admin duyệt.');
      form.resetFields();
    } catch (error) {
      message.error('Không thể gửi yêu cầu đổi mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <Typography.Title level={2} className={styles.pageTitle}>
        Yêu cầu đổi mật khẩu
      </Typography.Title>
      <Typography.Paragraph className={styles.pageDescription}>
        Nhập mật khẩu mới và lý do (nếu có). Admin sẽ xem xét và phê duyệt yêu cầu của bạn.
      </Typography.Paragraph>

      <Card className={styles.formCard} bordered={false}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu mới.' }]}
          >
            <Input.Password placeholder="Mật khẩu mới" />
          </Form.Item>

          <Form.Item
            label="Xác nhận mật khẩu"
            name="confirmPassword"
            rules={[{ required: true, message: 'Vui lòng xác nhận mật khẩu.' }]}
          >
            <Input.Password placeholder="Xác nhận mật khẩu" />
          </Form.Item>

          <Form.Item label="Lý do (tùy chọn)" name="reason">
            <Input.TextArea rows={4} placeholder="Bạn có thể nhập lý do đổi mật khẩu nếu muốn..." />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              className={styles.submitBtn}
              type="primary"
              htmlType="submit"
              loading={submitting}
            >
              Gửi yêu cầu
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
});
