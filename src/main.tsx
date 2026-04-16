import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthContext.tsx'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
if (!clientId) {
  throw new Error(
    'VITE_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env.local and add your Google OAuth client ID.'
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={clientId}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
