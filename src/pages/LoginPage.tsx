import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../auth/useAuth';

interface GoogleJwtPayload {
  name: string;
  email: string;
  picture: string;
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">💰</div>
        <h1 className="login-title">Budget App</h1>
        <p className="login-subtitle">Sign in to manage your budget</p>
        {error && <p className="form-error">{error}</p>}
        <div className="login-btn-wrap">
          <GoogleLogin
            onSuccess={(response) => {
              if (!response.credential) {
                setError('Sign-in failed: no credential returned. Please try again.');
                return;
              }
              try {
                const payload = jwtDecode<GoogleJwtPayload>(response.credential);
                signIn({ name: payload.name, email: payload.email, picture: payload.picture });
              } catch {
                setError('Sign-in failed: could not read account info. Please try again.');
              }
            }}
            onError={() => {
              setError('Google sign-in was unsuccessful. Please try again or check your network connection.');
            }}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
}
