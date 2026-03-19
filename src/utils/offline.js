/**
 * Offline Draft Saving
 * Saves drafts to localStorage when offline, syncs when back online
 * Never loses a practitioner's story to a bad connection
 */

const DRAFTS_KEY = 'drr_offline_drafts';
const CURRENT_DRAFT_KEY = 'drr_current_draft';

/**
 * Save the current work-in-progress draft (auto-save while typing)
 */
export function saveCurrentDraft({ title, story, photoNames }) {
  try {
    const draft = {
      title: title || '',
      story: story || '',
      photoNames: photoNames || [],
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(CURRENT_DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn('Could not auto-save draft:', e);
  }
}

/**
 * Load the current work-in-progress draft
 */
export function loadCurrentDraft() {
  try {
    const data = localStorage.getItem(CURRENT_DRAFT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Clear the current draft (after successful publish)
 */
export function clearCurrentDraft() {
  try {
    localStorage.removeItem(CURRENT_DRAFT_KEY);
  } catch (e) {
    // Ignore
  }
}

/**
 * Save a completed story that failed to publish (for later sync)
 * Note: photos are NOT saved offline (too large for localStorage)
 * Only title and story text are preserved
 */
export function saveOfflineDraft({ title, story }) {
  try {
    const drafts = getOfflineDrafts();
    drafts.push({
      id: Date.now().toString(),
      title,
      story,
      savedAt: new Date().toISOString(),
      synced: false
    });
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    return true;
  } catch (e) {
    console.error('Could not save offline draft:', e);
    return false;
  }
}

/**
 * Get all offline drafts waiting to be synced
 */
export function getOfflineDrafts() {
  try {
    const data = localStorage.getItem(DRAFTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Get count of unsynced offline drafts
 */
export function getUnsyncedCount() {
  return getOfflineDrafts().filter(d => !d.synced).length;
}

/**
 * Mark a draft as synced
 */
export function markDraftSynced(draftId) {
  try {
    const drafts = getOfflineDrafts();
    const updated = drafts.map(d =>
      d.id === draftId ? { ...d, synced: true } : d
    );
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(updated));
  } catch (e) {
    // Ignore
  }
}

/**
 * Remove synced drafts from storage
 */
export function clearSyncedDrafts() {
  try {
    const drafts = getOfflineDrafts().filter(d => !d.synced);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    // Ignore
  }
}

/**
 * Check if browser is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Register online/offline event listeners
 * Returns cleanup function
 */
export function watchConnection(onOnline, onOffline) {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
