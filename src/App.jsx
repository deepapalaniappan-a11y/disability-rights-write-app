import { useState, useEffect, useCallback } from 'react';
import LoginScreen from './screens/Login.jsx';
import WriteScreen from './screens/Write.jsx';
import SuccessScreen from './screens/Success.jsx';
import {
  extractTokenFromHash,
  saveToken,
  getStoredToken,
  fetchCurrentUser,
  saveUserInfo,
  getStoredUserInfo,
  logout as clearAuth
} from './api/auth.js';
import {
  getOfflineDrafts,
  markDraftSynced,
  clearSyncedDrafts,
  watchConnection,
  isOnline
} from './utils/offline.js';
import { createDraftPost } from './api/posts.js';

export default function App() {
  const [screen, setScreen] = useState('loading'); // loading | login | write | success
  const [author, setAuthor] = useState(null);
  const [token, setToken] = useState(null);
  const [publishedTitle, setPublishedTitle] = useState('');
  const [publishedOffline, setPublishedOffline] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Sync offline drafts when connection returns
  const syncOfflineDrafts = useCallback(async (accessToken) => {
    if (!accessToken) return;
    const drafts = getOfflineDrafts().filter(d => !d.synced);
    if (drafts.length === 0) return;

    setSyncing(true);
    setSyncMessage(`Syncing ${drafts.length} saved story${drafts.length > 1 ? 'ies' : ''}…`);

    for (const draft of drafts) {
      try {
        await createDraftPost(
          { title: draft.title, story: draft.story, media: [] },
          accessToken
        );
        markDraftSynced(draft.id);
      } catch (err) {
        console.error('Sync failed for draft:', draft.id, err);
      }
    }

    clearSyncedDrafts();
    setSyncing(false);
    setSyncMessage('');
  }, []);

  // Initialise: check for stored session or OAuth callback
  useEffect(() => {
    async function init() {
      // 1. Check for OAuth callback token in URL hash
      const callbackToken = extractTokenFromHash();
      if (callbackToken) {
        try {
          const user = await fetchCurrentUser(callbackToken);
          saveToken(callbackToken);
          saveUserInfo(user);
          setToken(callbackToken);
          setAuthor(user);
          setScreen('write');
          // Sync any offline drafts
          syncOfflineDrafts(callbackToken);
          return;
        } catch (err) {
          setLoginError(err.message || 'Login failed. Please try again.');
          setScreen('login');
          return;
        }
      }

      // 2. Check for stored session
      const storedToken = getStoredToken();
      const storedUser = getStoredUserInfo();

      if (storedToken && storedUser) {
        setToken(storedToken);
        setAuthor(storedUser);
        setScreen('write');
        // Verify token is still valid (in background)
        try {
          const freshUser = await fetchCurrentUser(storedToken);
          saveUserInfo(freshUser);
          setAuthor(freshUser);
          syncOfflineDrafts(storedToken);
        } catch {
          // Token expired — force re-login
          clearAuth();
          setToken(null);
          setAuthor(null);
          setLoginError('Your session has expired. Please sign in again.');
          setScreen('login');
        }
        return;
      }

      // 3. No session — show login
      setScreen('login');
    }

    init();
  }, [syncOfflineDrafts]);

  // Watch online/offline status
  useEffect(() => {
    const cleanup = watchConnection(
      () => {
        setOnline(true);
        if (token) syncOfflineDrafts(token);
      },
      () => setOnline(false)
    );
    return cleanup;
  }, [token, syncOfflineDrafts]);

  // Handlers
  const handlePublish = ({ title, offline, postId, postUrl }) => {
    setPublishedTitle(title);
    setPublishedOffline(!!offline);
    setScreen('success');
  };

  const handleNewStory = () => {
    setScreen('write');
  };

  const handleLogout = () => {
    clearAuth();
    setAuthor(null);
    setToken(null);
    setLoginError('');
    setScreen('login');
  };

  // Loading state
  if (screen === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#faf9f7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">✍️</div>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '1rem',
          color: '#888'
        }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Skip link for keyboard/screen reader users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Offline banner */}
      {!online && (
        <div
          className="offline-banner"
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#92400e',
            color: '#fff',
            textAlign: 'center',
            padding: '10px 16px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 500
          }}
        >
          You are offline. Stories will be saved and published when connected.
        </div>
      )}

      {/* Syncing banner */}
      {syncing && syncMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: !online ? 40 : 0,
            left: 0,
            right: 0,
            zIndex: 49,
            background: '#1e40af',
            color: '#fff',
            textAlign: 'center',
            padding: '8px 16px',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 500
          }}
        >
          <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }} aria-hidden="true"></span>
          {syncMessage}
        </div>
      )}

      <div
        id="main-content"
        style={{ paddingTop: !online ? 40 : 0 }}
      >
        {screen === 'login' && (
          <LoginScreen
            error={loginError}
          />
        )}
        {screen === 'write' && author && (
          <WriteScreen
            author={author}
            token={token}
            onPublish={handlePublish}
            onLogout={handleLogout}
          />
        )}
        {screen === 'success' && author && (
          <SuccessScreen
            author={author}
            title={publishedTitle}
            offline={publishedOffline}
            onNewStory={handleNewStory}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}
