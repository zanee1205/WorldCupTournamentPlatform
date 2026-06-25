import { RouterProvider } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

import { AppErrorState } from './components/AppState/AppErrorState.tsx';
import { AppLoadingState } from './components/AppState/AppLoadingState.tsx';
import { WorldcupDataProvider } from './context/WorldcupDataContext.tsx';
import { useAppBootstrap } from './hooks/useAppBootstrap.ts';
import { routers } from './routers/index.tsx';
import { appStore } from './store/matchStore.ts';

export default observer(function App() {
  useAppBootstrap();

  if (appStore.loading && !appStore.dashboard) {
    return <AppLoadingState />;
  }

  if (!appStore.dashboard) {
    return <AppErrorState description={appStore.errorMessage ?? 'Vui lòng thử lại.'} />;
  }

  return (
    <WorldcupDataProvider>
      <RouterProvider router={routers} />
    </WorldcupDataProvider>
  );
});
