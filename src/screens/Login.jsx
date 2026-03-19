import { useState } from 'react';
import { startOAuthFlow } from '../api/auth.js';

export default function LoginScreen({ onLogin, isLoading, error: externalError }) {
  const [loggingIn, setLoggingIn] = useState(false);

  const handleSignIn = () => {
    setLoggingIn(true);
    startOAuthFlow();
  };

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: '#faf9f7',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <main
        role="main"
        aria-label="Sign in to write your story"
        style={{ padding: '24px', maxWidth: 480, margin: '0 auto', width: '100%' }}
      >
        {/* App Identity */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">✍️</div>
          <h1 style={{
            fontFamily: "'Source Serif 4', 'Georgia', serif",
            fontSize: '1.6rem',
            fontWeight: 700,
            color: '#1a1a1a',
            lineHeight: 1.3,
            margin: '0 0 8px 0'
          }}>
            Disability Rights Repository
          </h1>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.95rem',
            color: '#555',
            margin: 0
          }}>
            Share your story from the field
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: '#f8f6f3',
          borderRadius: 16,
          padding: 28,
          border: '1px solid #e8e4de'
        }}>
          <h2 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: 10,
            marginTop: 0
          }}>
            Sign in to write
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.85rem',
            color: '#666',
            margin: '0 0 16px 0',
            lineHeight: 1.5
          }}>
            Sign in with your WordPress.com account to post stories.
            <br />Don't have one?{' '}
            <a
              href="https://disability-rights-repository.org/submit-your-story/"
              style={{ color: '#2563eb' }}
              target="_blank"
              rel="noreferrer"
            >
              Register here
            </a>
          </p>

          {/* Error message */}
          {externalError && (
            <div
              role="alert"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 16
              }}
            >
              <p style={{
                color: '#dc2626',
                fontSize: '0.9rem',
                fontFamily: "'DM Sans', sans-serif",
                margin: 0,
                lineHeight: 1.5
              }}>
                {externalError}
              </p>
            </div>
          )}

          {/* Sign In Button — triggers OAuth flow */}
          <button
            onClick={handleSignIn}
            disabled={isLoading || loggingIn}
            aria-label="Sign in with your WordPress.com account"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '1.1rem',
              fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              background: (isLoading || loggingIn) ? '#555' : '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: (isLoading || loggingIn) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 52
            }}
          >
            {(isLoading || loggingIn) ? (
              <>
                <span className="spinner" aria-hidden="true"></span>
                Signing in…
              </>
            ) : (
              'Sign In with WordPress.com'
            )}
          </button>
        </div>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.8rem',
          color: '#888',
          marginTop: 24,
          lineHeight: 1.6
        }}>
          disability-rights-repository.org
          <br />Community-driven · Not funded by any NGO
        </p>
      </main>
    </div>
  );
}
