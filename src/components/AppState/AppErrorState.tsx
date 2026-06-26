import { Alert, Button } from 'antd';

import styles from '../../App.module.scss';

import { refreshApp } from '../../hooks/useAppBootstrap.ts';

type AppErrorStateProps = {
    message?: string;
    description?: string;
    onRetry?: () => void | Promise<void>;
};

export function AppErrorState({
    message = 'Đã xảy ra lỗi',
    description = 'Vui lòng thử lại',
    onRetry,
}: AppErrorStateProps) {
    return (
        <div className={styles.loadingScreen}>
            <Alert
                type="error"
                showIcon
                message={message}
                description={description}
                action={
                    <Button
                        type="primary"
                        onClick={() => {
                            if (onRetry) {
                                void onRetry();
                                return;
                            }

                            void refreshApp();
                        }}
                    >
                        Thá»­ láº¡i
                    </Button>
                }
            />
        </div>
    );
}
