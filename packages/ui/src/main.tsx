import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ResearchModeProvider } from './context/ResearchMode';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ResearchModeProvider>
      <App />
    </ResearchModeProvider>
  </React.StrictMode>,
);
