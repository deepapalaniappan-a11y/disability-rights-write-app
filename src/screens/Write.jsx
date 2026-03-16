import { useState, useRef, useEffect, useCallback } from 'react';
import { compressImage, isImage } from '../utils/compress.js';
import { uploadMultipleMedia } from '../api/media.js';
import { createDraftPost } from '../api/posts.js';
import {
  saveCurrentDraft,
  loadCurrentDraft,
  clearCurrentDraft,
  saveOfflineDraft,
  isOnline
} from '../utils/offline.js';

export default function WriteScreen({ author, token, onPublish, onLogout }) {
  const [title, setTitle] = useState('');
  const [story, setStory] = useState('');
  const [photos, setPhotos] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [publishStep, setPublishStep] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef(null);
  const autoSaveTimer = useRef(null);

  // Load saved draft on mount
  useEffect(() => {
    const saved = loadCurrentDraft();
    if (saved) {
      if (saved.title) setTitle(saved.title);
      if (saved.story) setStory(saved.story);
    }
  }, []);

  // Auto-save draft as user types (debounced)
  const scheduleSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveCurrentDraft({
        title,
        story,
        photoNames: photos.map(p => p.name)
      });
    }, 1000);
  }, [title, story, photos]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [title, story, photos, scheduleSave]);

  // Handle photo selection
  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((f) => ({
      file: f,
      preview: URL.createObjectURL(f),
      name: f.name
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Publish flow: compress images → upload media → create draft post
  const handlePublish = async () => {
    if (!title.trim() || !story.trim()) return;
    setPublishing(true);
    setError('');

    // Check if offline
    if (!isOnline()) {
      const saved = saveOfflineDraft({ title: title.trim(), story: story.trim() });
      if (saved) {
        clearCurrentDraft();
        onPublish({
          title: title.trim(),
          offline: true
        });
      } else {
        setError('Could not save your story. Please try again.');
        setPublishing(false);
      }
      return;
    }

    try {
      let uploadedMedia = [];

      // Step 1: Compress and upload photos
      if (photos.length > 0) {
        setPublishStep(`Preparing ${photos.length} photo${photos.length > 1 ? 's' : ''}…`);

        // Compress images
        const compressedFiles = [];
        for (const photo of photos) {
          if (isImage(photo.file)) {
            const compressed = await compressImage(photo.file);
            compressedFiles.push(compressed);
          } else {
            compressedFiles.push(photo.file);
          }
        }

        setPublishStep(`Uploading photo${photos.length > 1 ? 's' : ''}…`);

        uploadedMedia = await uploadMultipleMedia(
          compressedFiles,
          token,
          (done, total) => {
            setPublishStep(`Uploaded ${done} of ${total} photo${total > 1 ? 's' : ''}…`);
          }
        );
      }

      // Step 2: Create draft post
      setPublishStep('Publishing your story…');

      const post = await createDraftPost(
        {
          title: title.trim(),
          story: story.trim(),
          media: uploadedMedia
        },
        token
      );

      // Success — clean up
      clearCurrentDraft();
      photos.forEach(p => {
        if (p.preview) URL.revokeObjectURL(p.preview);
      });

      onPublish({
        title: post.title,
        postId: post.id,
        postUrl: post.url,
        offline: false
      });
    } catch (err) {
      console.error('Publish error:', err);

      // If network error, offer offline save
      if (!isOnline() || err.message.includes('fetch') || err.message.includes('network')) {
        const saved = saveOfflineDraft({ title: title.trim(), story: story.trim() });
        if (saved) {
          setError('Connection lost. Your story has been saved and will be published when you are back online.');
        } else {
          setError('Connection lost and could not save locally. Please try again.');
        }
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
      setPublishing(false);
      setPublishStep('');
    }
  };

  const canPublish = title.trim().length > 0 && story.trim().length > 0;
  const wordCount = story.length > 0 ? story.split(/\s+/).filter(Boolean).length : 0;

  return (
    <div style={{
      minHeight: '100vh',
      minHeight: '100dvh',
      background: '#fff'
    }}>
      <main
        role="main"
        aria-label="Write your story"
        style={{ maxWidth: 560, margin: '0 auto', padding: '16px 20px' }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
          paddingBottom: 12,
          borderBottom: '1px solid #e5e5e5'
        }}>
          <div>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              color: '#888',
              margin: 0
            }}>
              Writing as
            </p>
            <p style={{
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#1a1a1a',
              margin: '2px 0 0 0'
            }}>
              {author.name}
            </p>
          </div>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.85rem',
              color: '#666',
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: 8,
              padding: '6px 14px',
              cursor: 'pointer',
              minHeight: 40
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 20
            }}
          >
            <p style={{
              color: '#dc2626',
              fontSize: '0.9rem',
              fontFamily: "'DM Sans', sans-serif",
              margin: 0,
              lineHeight: 1.5
            }}>
              {error}
            </p>
          </div>
        )}

        {/* Title */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="story-title"
            style={{
              display: 'block',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#333',
              marginBottom: 6
            }}
          >
            Title of Your Story <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <input
            id="story-title"
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setError(''); }}
            placeholder="What is your story about?"
            required
            aria-required="true"
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '1.1rem',
              fontFamily: "'Source Serif 4', Georgia, serif",
              fontWeight: 600,
              border: '2px solid #ddd',
              borderRadius: 10,
              outline: 'none',
              boxSizing: 'border-box',
              background: '#fff'
            }}
          />
        </div>

        {/* Story */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="story-body"
            style={{
              display: 'block',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#333',
              marginBottom: 6
            }}
          >
            Your Story <span aria-hidden="true">*</span>
            <span className="sr-only">(required)</span>
          </label>
          <p
            id="story-hint"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8rem',
              color: '#888',
              margin: '0 0 8px 0'
            }}
          >
            Write in any language. As much or as little as you like.
          </p>
          <textarea
            id="story-body"
            value={story}
            onChange={(e) => { setStory(e.target.value); setError(''); }}
            placeholder="Write your story here... Tell us what happened, what you saw, what you did, and why it matters."
            rows={10}
            required
            aria-required="true"
            aria-describedby="story-hint story-wordcount"
            style={{
              width: '100%',
              padding: '14px 16px',
              fontSize: '1rem',
              fontFamily: "'DM Sans', sans-serif",
              border: '2px solid #ddd',
              borderRadius: 10,
              outline: 'none',
              boxSizing: 'border-box',
              resize: 'vertical',
              lineHeight: 1.7,
              background: '#fff'
            }}
          />
          <p
            id="story-wordcount"
            aria-live="polite"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.8rem',
              color: '#aaa',
              margin: '6px 0 0 0',
              textAlign: 'right'
            }}
          >
            {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : ''}
          </p>
        </div>

        {/* Photos */}
        <div style={{ marginBottom: 28 }}>
          <label style={{
            display: 'block',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.9rem',
            fontWeight: 600,
            color: '#333',
            marginBottom: 6
          }}>
            Photos or Videos
          </label>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8rem',
            color: '#888',
            margin: '0 0 12px 0'
          }}>
            Add photos from your work, DPO activities, events, or community.
          </p>

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div
              role="list"
              aria-label="Selected photos"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 12
              }}
            >
              {photos.map((p, i) => (
                <div key={i} role="listitem" style={{ position: 'relative' }}>
                  <img
                    src={p.preview}
                    alt={`Photo ${i + 1}: ${p.name}`}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'cover',
                      borderRadius: 8,
                      border: '1px solid #ddd'
                    }}
                  />
                  <button
                    onClick={() => removePhoto(i)}
                    aria-label={`Remove photo ${i + 1}`}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#fff',
                      border: 'none',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 26
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handlePhotos}
            style={{ display: 'none' }}
            aria-label="Select photos or videos"
          />
          <button
            onClick={() => fileRef.current?.click()}
            type="button"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.95rem',
              fontWeight: 500,
              color: '#555',
              background: '#f5f5f5',
              border: '2px dashed #ccc',
              borderRadius: 10,
              cursor: 'pointer',
              width: '100%',
              justifyContent: 'center',
              minHeight: 48
            }}
          >
            <span style={{ fontSize: 20 }} aria-hidden="true">📷</span>
            Add Photos or Videos
          </button>
        </div>

        {/* Publish */}
        <button
          onClick={handlePublish}
          disabled={!canPublish || publishing}
          aria-label={publishing ? publishStep || 'Publishing your story' : 'Publish your story'}
          style={{
            width: '100%',
            padding: '18px',
            fontSize: '1.15rem',
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            background: canPublish ? '#16a34a' : '#ccc',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            cursor: canPublish && !publishing ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 56
          }}
        >
          {publishing ? (
            <>
              <span className="spinner" aria-hidden="true"></span>
              {publishStep || 'Publishing…'}
            </>
          ) : (
            <>✅ Publish My Story</>
          )}
        </button>

        {!canPublish && !publishing && (
          <p style={{
            textAlign: 'center',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '0.8rem',
            color: '#aaa'
          }}>
            Add a title and story to publish
          </p>
        )}

        <p style={{
          textAlign: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '0.75rem',
          color: '#aaa',
          marginTop: 20,
          lineHeight: 1.6
        }}>
          Your story will be published with your name as the author.
          <br />The coordinator may add categories and formatting.
        </p>
      </main>
    </div>
  );
}
