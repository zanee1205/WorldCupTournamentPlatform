import { Alert, Button } from 'antd';

import styles from '../../App.module.scss';

import { refreshApp } from '../../hooks/useAppBootstrap.ts';

type AppErrorStateProps = {
    message?: string;
    description?: string;
};

export function AppErrorState({ message = 'Không tải được dữ liệu.', description = 'Vui lòng thử lại.' }: AppErrorStateProps) {
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
                            void refreshApp('initial');
                        }}
                    >
                        Thử lại
                    </Button>
                }
            />
        </div>
    );
}
