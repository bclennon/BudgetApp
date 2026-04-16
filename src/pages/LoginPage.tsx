import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../auth/useAuth';

function decodeGoogleCredential(credential: string): { name: string; email: string; picture: string } {
  const payload = credential.split('.')[1];
  const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
  return JSON.parse(decoded) as { name: string; email: string; picture: string };
}

export default function LoginPage() {
  const { signIn } = useAuth();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">💰</div>
        <h1 className="login-title">Budget App</h1>
        <p className="login-subtitle">Sign in to manage your budget</p>
        <div className="login-btn-wrap">
          <GoogleLogin
            onSuccess={(response) => {
              if (!response.credential) return;
              const payload = decodeGoogleCredential(response.credential);
              signIn({ name: payload.name, email: payload.email, picture: payload.picture });
            }}
            onError={() => {
              console.error('Google sign-in failed');
            }}
            useOneTap
          />
        </div>
      </div>
    </div>
  );
}
