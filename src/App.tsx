import { RouterProvider } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { AppErrorState } from './components/AppState/AppErrorState.tsx';
import { AppLoadingState } from './components/AppState/AppLoadingState.tsx';
import { useAppBootstrap } from './hooks/useAppBootstrap.ts';
import { routers } from './routers/index.tsx';
import { authStore } from './store/authStore.ts';

export default observer(function App() {
  useAppBootstrap();

  if (authStore.status === 'checking') {
    return <AppLoadingState message="Đang xác thực phiên đăng nhập..." />;
  }

  if (authStore.status === 'error') {
    return <AppErrorState description={authStore.errorMessage ?? 'Vui lòng thử lại.'} onRetry={() => {authStore.bootstrap()}} />;
  }

  return <RouterProvider router={routers} />;
});
