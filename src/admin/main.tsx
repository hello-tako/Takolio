import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp, createAdminQueryClient } from './App';
import '../web/styles/takosan-tokens.css';
import './styles/fonts.css';
import './styles/admin.css';

const queryClient = createAdminQueryClient();

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp queryClient={queryClient} />
  </StrictMode>,
);
