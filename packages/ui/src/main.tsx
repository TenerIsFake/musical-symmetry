import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ResearchModeProvider } from './context/ResearchMode';
import { UserProvider } from './context/UserContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UserProvider>
      <ResearchModeProvider>
        <App />
      </ResearchModeProvider>
    </UserProvider>
  </React.StrictMode>,
);
