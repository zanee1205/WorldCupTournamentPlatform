import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'antd/dist/reset.css';
import './styles/index.css';
import { WorldcupDataProvider } from './context/WorldcupDataContext';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <WorldcupDataProvider>
        <App />
      </WorldcupDataProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
