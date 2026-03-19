/**
 * WordPress.com OAuth2 Authentication
 * Uses implicit grant flow (token returned in URL hash)
 */

const CLIENT_ID = '135209';
const SITE_ID = '132820693';
const TOKEN_KEY = 'drr_access_token';
const USER_KEY = 'drr_user_info';

/**
 * Get the redirect URI (current origin)
 */
function getRedirectUri() {
  return window.location.origin + window.location.pathname;
}

/**
 * Redirect the user to WordPress.com for authentication
 */
export function startOAuthFlow() {
  const redirectUri = getRedirectUri();
  const authUrl = new URL('https://public-api.wordpress.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', 'global');
  window.location.href = authUrl.toString();
}

/**
 * Check URL hash for OAuth token (called on page load after redirect back)
 * Returns token if found, null otherwise
 */
export function extractTokenFromHash() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return null;

  const params = new URLSearchParams(hash.substring(1));
  const token = params.get('access_token');

  if (token) {
    // Clean the hash from URL without triggering reload
    history.replaceState(null, '', window.location.pathname + window.location.search);
    return token;
  }
  return null;
}

/**
 * Save token to localStorage
 */
export function saveToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn('Could not save token to localStorage:', e);
  }
}

/**
 * Get stored token
 */
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

/**
 * Save user info to localStorage
 */
export function saveUserInfo(user) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Could not save user info:', e);
  }
}

/**
 * Get stored user info
 */
export function getStoredUserInfo() {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Fetch current user info from WordPress.com
 * Returns { id, username, display_name, avatar_URL }
 */
export async function fetchCurrentUser(token) {
  const res = await fetch('https://public-api.wordpress.com/rest/v1.1/me', {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('Could not verify your login. Please try again.');
  }

  const data = await res.json();
  return {
    id: data.ID,
    username: data.username,
    name: data.display_name || data.username,
    avatar: data.avatar_URL
  };
}

/**
 * Log out: clear stored credentials
 */
export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Get auth headers for API requests
 */
export function getAuthHeaders(token) {
  return {
    Authorization: `Bearer ${token}`
  };
}

export { SITE_ID };
