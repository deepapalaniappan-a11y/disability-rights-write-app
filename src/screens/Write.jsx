import { useState, useRef, useEffect, useCallback } from 'react';
import { compressImage, isImage, isVideo } from '../utils/compress.js';
import { uploadMultipleMedia } from '../api/media.js';
import { createDraftPost } from '../api/posts.js';
import { saveCurrentDraft, loadCurrentDraft, clearCurrentDraft, saveOfflineDraft, isOnline } from '../utils/offline.js';

const MAX_FILES = 10;
const LARGE_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createFilePreview(file) {
    if (isImage(file)) {
          return { preview: URL.createObjectURL(file), isVideo: false };
    }
    return { preview: null, isVideo: true };
}

export default function WriteScreen({ author, token, onPublish, onLogout }) {
    const [title, setTitle] = useState('');
    const [story, setStory] = useState('');
    const [files, setFiles] = useState([]);
    const [region, setRegion] = useState('');
    const [language, setLanguage] = useState('');
    const [publishing, setPublishing] = useState(false);
    const [publishStep, setPublishStep] = useState('');
    const [error, setError] = useState('');
    const fileRef = useRef(null);
    const autoSaveTimer = useRef(null);

  useEffect(() => {
        const saved = loadCurrentDraft();
        if (saved) {
                if (saved.title) setTitle(saved.title);
                if (saved.story) setStory(saved.story);
                if (saved.region) setRegion(saved.region);
                if (saved.language) setLanguage(saved.language);
}
  }, []);

  const scheduleSave = useCallback(() => {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => {
                saveCurrentDraft({ title, story, region, language, photoNames: files.map(p => p.name) });
        }, 1000);
  }, [title, story, region, language, files]);

  useEffect(() => {
        scheduleSave();
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [title, story, region, language, files, scheduleSave]);

  const handleFiles = (e) => {
        const selected = Array.from(e.target.files);
        const remaining = MAX_FILES - files.length;
        if (remaining <= 0) {
                setError(`You can add up to ${MAX_FILES} photos or videos.`);
                e.target.value = '';
                return;
        }
        const toAdd = selected.slice(0, remaining);
        if (selected.length > remaining) {
                setError(`Only ${remaining} more file${remaining !== 1 ? 's' : ''} can be added (maximum ${MAX_FILES}).`);
        }
        const newFiles = toAdd.map((f) => {
                const { preview, isVideo: isVid } = createFilePreview(f);
                return { file: f, preview, isVideo: isVid, name: f.name, size: f.size, isFeatured: false };
        });
        setFiles((prev) => {
                const updated = [...prev, ...newFiles];
                const hasFeatured = updated.some(f => f.isFeatured);
                if (!hasFeatured) {
                          const firstImage = updated.find(f => !f.isVideo);
                          if (firstImage) firstImage.isFeatured = true;
                }
                return updated;
        });
        e.target.value = '';
  };

  const removeFile = (index) => {
        setFiles((prev) => {
                const removed = prev[index];
                if (removed?.preview) URL.revokeObjectURL(removed.preview);
                const updated = prev.filter((_, i) => i !== index);
                if (removed?.isFeatured) {
                          const nextImage = updated.find(f => !f.isVideo);
                          if (nextImage) nextImage.isFeatured = true;
                }
                return updated;
        });
        if (error && error.includes('maximum')) setError('');
  };

  const toggleFeatured = (index) => {
        setFiles((prev) => {
                if (prev[index].isVideo) return prev;
                return prev.map((f, i) => ({ ...f, isFeatured: i === index }));
        });
  };

  const imageCount = files.filter(f => !f.isVideo).length;
    const videoCount = files.filter(f => f.isVideo).length;
    const hasLargeVideo = files.some(f => f.isVideo && f.size > LARGE_VIDEO_SIZE);

  const handlePublish = async () => {
        if (!title.trim() || !story.trim()) return;
        setPublishing(true);
        setError('');

        if (!isOnline()) {
                const saved = saveOfflineDraft({ title: title.trim(), story: story.trim() });
                if (saved) {
                          clearCurrentDraft();
                          onPublish({ title: title.trim(), offline: true });
                } else {
                          setError('Could not save your story. Please try again.');
                          setPublishing(false);
                }
                return;
        }

        try {
                let uploadedMedia = [];
                let featuredImageId = null;

          if (files.length > 0) {
                    const fileLabel = (imageCount > 0 && videoCount > 0)
                      ? `${imageCount} photo${imageCount !== 1 ? 's' : ''} and ${videoCount} video${videoCount !== 1 ? 's' : ''}`
                                : videoCount > 0
                        ? `${videoCount} video${videoCount !== 1 ? 's' : ''}`
                                  : `${imageCount} photo${imageCount !== 1 ? 's' : ''}`;

                  setPublishStep(`Preparing ${fileLabel}\u2026`);

                  const preparedFiles = [];
                    const featuredIndex = files.findIndex(f => f.isFeatured);
                    for (let i = 0; i < files.length; i++) {
                                const f = files[i];
                                if (isImage(f.file)) {
                                              const compressed = await compressImage(f.file);
                                              preparedFiles.push(compressed);
                                } else {
                                              preparedFiles.push(f.file);
                                }
                    }

                  setPublishStep(`Uploading ${fileLabel}\u2026`);
                    uploadedMedia = await uploadMultipleMedia(
                                preparedFiles,
                                token,
                                (done, total) => {
                                              setPublishStep(`Uploaded ${done} of ${total} file${total > 1 ? 's' : ''}\u2026`);
                                }
                              );

                  if (featuredIndex >= 0 && uploadedMedia[featuredIndex]) {
                              featuredImageId = uploadedMedia[featuredIndex].id;
                  }
          }

          setPublishStep('Submitting your story\u2026');
                const post = await createDraftPost(
                  { title: title.trim(), story: story.trim(), media: uploadedMedia, featuredImageId, region, language },
                          token
                        );

          clearCurrentDraft();
                files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview); });
                onPublish({ title: post.title, postId: post.id, postUrl: post.url, offline: false });

        } catch (err) {
                console.error('Publish error:', err);
                if (!isOnline() || err.message.includes('fetch') || err.message.includes('network')) {
                          const saved = saveOfflineDraft({ title: title.trim(), story: story.trim() });
                          if (saved) {
                                      setError('Connection lost. Your story text has been saved and will publish when you are back online. Photos and videos will need to be re-added.');
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
        <div style={{ minHeight: '100vh', minHeight: '100dvh', background: '#fff' }}>
                <main role="main" aria-label="Write your story" style={{ maxWidth: 560, margin: '0 auto', padding: '16px 20px' }}>

                  {/* Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #e5e5e5' }}>
                                      <div>
                                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: '#888', margin: 0 }}>Writing as</p>p>
                                                  <p style={{ fontFamily: "'Source Serif 4', Georgia, serif", fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', margin: '2px 0 0 0' }}>{author.name}</p>p>
                                      </div>div>
                                    <button onClick={onLogout} aria-label="Sign out" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', color: '#666', background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', minHeight: 40 }}>Sign Out</button>button>
                          </div>div>
                
                  {/* Error */}
                  {error && (
                    <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                                <p style={{ color: '#dc2626', fontSize: '0.9rem', fontFamily: "'DM Sans', sans-serif", margin: 0, lineHeight: 1.5 }}>{error}</p>p>
                    </div>div>
                        )}
                
                  {/* Title */}
                        <div style={{ marginBottom: 20 }}>
                                  <label htmlFor="story-title" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>
                                              Title of Your Story <span aria-hidden="true">*</span>span><span className="sr-only">(required)</span>span>
                                  </label>label>
                                  <input id="story-title" type="text" value={title} onChange={(e) => { setTitle(e.target.value); setError(''); }} placeholder="What is your story about?" required aria-required="true"
                                                style={{ width: '100%', padding: '14px 16px', fontSize: '1.1rem', fontFamily: "'Source Serif 4', Georgia, serif", fontWeight: 600, border: '2px solid #ddd', borderRadius: 10, outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
                        </div>div>
                
                  {/* Story */}
                        <div style={{ marginBottom: 20 }}>
                                  <label htmlFor="story-body" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>
                                              Your Story <span aria-hidden="true">*</span>span><span className="sr-only">(required)</span>span>
                                  </label>label>
                                  <p id="story-hint" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#888', margin: '0 0 8px 0' }}>
                                              Write in any language. As much or as little as you like.
                                  </p>p>
                                  <textarea id="story-body" value={story} onChange={(e) => { setStory(e.target.value); setError(''); }} placeholder="Write your story here... Tell us what happened, what you saw, what you did, and why it matters." rows={10} required aria-required="true" aria-describedby="story-hint story-wordcount"
                                                style={{ width: '100%', padding: '14px 16px', fontSize: '1rem', fontFamily: "'DM Sans', sans-serif", border: '2px solid #ddd', borderRadius: 10, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.7, background: '#fff' }} />
                                  <p id="story-wordcount" aria-live="polite" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#aaa', margin: '6px 0 0 0', textAlign: 'right' }}>
                                    {wordCount > 0 ? `${wordCount} word${wordCount !== 1 ? 's' : ''}` : ''}
                                  </p>p>
                        </div>div>
                
                  {/* Photos & Videos */}
                        <div style={{ marginBottom: 24 }}>
                                  <label style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', fontWeight: 600, color: '#333', marginBottom: 6 }}>
                                              Photos or Videos
                                  </label>label>
                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#888', margin: '0 0 12px 0' }}>
                                              Add photos or videos from your work, DPO activities, events, or community. Up to {MAX_FILES} files.
                                  </p>p>
                        
                          {hasLargeVideo && (
                      <div role="status" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#92400e', margin: 0, lineHeight: 1.5 }}>
                                                    Large video detected — uploading may take a while on slow connections. Consider trimming your video before uploading.
                                    </p>p>
                      </div>div>
                                  )}
                        
                          {files.length > 0 && (
                      <div role="list" aria-label="Selected files" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        {files.map((f, i) => (
                                        <div key={i} role="listitem" style={{ position: 'relative', width: 80, height: 80 }}>
                                          {f.isVideo ? (
                                                              <div style={{ width: 80, height: 80, borderRadius: 8, border: '1px solid #ddd', background: '#f3f4f6', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }} aria-label={`Video: ${f.name}`}>
                                                                                    <span style={{ fontSize: 24 }} aria-hidden="true">🎬</span>span>
                                                                                    <span style={{ fontSize: '0.6rem', color: '#666', fontFamily: "'DM Sans', sans-serif", maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{formatSize(f.size)}</span>span>
                                                              </div>div>
                                                            ) : (
                                                              <img src={f.preview} alt={`Photo ${i + 1}: ${f.name}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: f.isFeatured ? '3px solid #f59e0b' : '1px solid #ddd' }} />
                                                            )}
                                          {!f.isVideo && (
                                                              <button onClick={() => toggleFeatured(i)} aria-label={f.isFeatured ? `Photo ${i + 1} is the cover photo` : `Set photo ${i + 1} as cover photo`} title={f.isFeatured ? 'Cover photo' : 'Set as cover photo'}
                                                                                      style={{ position: 'absolute', bottom: -4, left: -4, width: 24, height: 24, borderRadius: '50%', background: f.isFeatured ? '#f59e0b' : '#e5e7eb', color: f.isFeatured ? '#fff' : '#9ca3af', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 24, padding: 0, lineHeight: 1 }}>★</button>button>
                                                          )}
                                                          <button onClick={() => removeFile(i)} aria-label={`Remove ${f.isVideo ? 'video' : 'photo'} ${i + 1}`}
                                                                                style={{ position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: '50%', background: '#dc2626', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 26, padding: 0 }}>✕</button>button>
                                        </div>div>
                                      ))}
                      </div>div>
                                  )}
                        
                          {files.length > 0 && imageCount > 1 && (
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#888', margin: '0 0 12px 0' }}>
                                    <span style={{ color: '#f59e0b' }}>★</span>span> Tap the star to choose your cover photo — it appears on the Stories page.
                      </p>p>
                                  )}
                        
                          {/* File input — no capture attribute so users can choose gallery OR camera */}
                                  <input
                                                ref={fileRef}
                                                type="file"
                                                accept="image/*,video/*"
                                                multiple
                                                onChange={handleFiles}
                                                style={{ display: 'none' }}
                                                aria-label="Select photos or videos"
                                              />
                        
                                  <button onClick={() => fileRef.current?.click()} type="button" disabled={files.length >= MAX_FILES}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.95rem', fontWeight: 500, color: files.length >= MAX_FILES ? '#aaa' : '#555', background: '#f5f5f5', border: '2px dashed #ccc', borderRadius: 10, cursor: files.length >= MAX_FILES ? 'not-allowed' : 'pointer', width: '100%', justifyContent: 'center', minHeight: 48 }}>
                                              <span style={{ fontSize: 20 }} aria-hidden="true">📷</span>span>
                                    {files.length >= MAX_FILES ? `Maximum ${MAX_FILES} files reached` : files.length > 0 ? 'Add More Photos or Videos' : 'Add Photos or Videos'}
                                  </button>button>
                        </div>div>
                
                  {/* Region & Language */}
                        <div style={{ marginBottom: 28, padding: '16px', background: '#faf9f7', borderRadius: 12, border: '1px solid #e8e4de' }}>
                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.85rem', fontWeight: 600, color: '#555', margin: '0 0 4px 0' }}>Optional — helps us categorise your story faster</p>p>
                                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#888', margin: '0 0 14px 0' }}>The coordinator can also set these later.</p>p>
                                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                              <div style={{ flex: '1 1 200px' }}>
                                                            <label htmlFor="story-region" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Your Region</label>label>
                                                            <select id="story-region" value={region} onChange={(e) => setRegion(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#333', minHeight: 44, appearance: 'auto' }}>
                                                                            <option value="">Select region…</option>option>
                                                                            <option value="east-africa">East Africa</option>option>
                                                                            <option value="southern-africa">Southern Africa</option>option>
                                                                            <option value="south-asia">South Asia</option>option>
                                                                            <option value="other">Other</option>option>
                                                            </select>select>
                                              </div>div>
                                              <div style={{ flex: '1 1 200px' }}>
                                                            <label htmlFor="story-language" style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: 4 }}>Story Language</label>label>
                                                            <select id="story-language" value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontFamily: "'DM Sans', sans-serif", fontSize: '0.9rem', border: '1px solid #ddd', borderRadius: 8, background: '#fff', color: '#333', minHeight: 44, appearance: 'auto' }}>
                                                                            <option value="">Select language…</option>option>
                                                                            <option value="english">English</option>option>
                                                                            <option value="hindi">Hindi</option>option>
                                                                            <option value="tamil">Tamil</option>option>
                                                                            <option value="other">Other</option>option>
                                                            </select>select>
                                              </div>div>
                                  </div>div>
                        </div>div>
                
                  {/* Submit */}
                        <button onClick={handlePublish} disabled={!canPublish || publishing} aria-label={publishing ? publishStep || 'Submitting your story' : 'Submit your story'}
                                    style={{ width: '100%', padding: '18px', fontSize: '1.15rem', fontWeight: 700, fontFamily: "'DM Sans', sans-serif", background: canPublish && !publishing ? '#16a34a' : '#ccc', color: '#fff', border: 'none', borderRadius: 12, cursor: canPublish && !publishing ? 'pointer' : 'not-allowed', transition: 'background 0.2s', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56 }}>
                          {publishing ? (
                                                  <><span className="spinner" aria-hidden="true"></span>span><span aria-live="polite">{publishStep || 'Submitting…'}</span>span></>>
                                                ) : (
                                                  '✅ Submit My Story'
                                                )}
                        </button>button>
                
                  {!canPublish && !publishing && (
                    <p style={{ textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '0.8rem', color: '#aaa' }}>Add a title and story to publish</p>p>
                        )}
                
                        <p style={{ textAlign: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: '0.75rem', color: '#aaa', marginTop: 20, lineHeight: 1.6 }}>
                                  Your story will be published with your name as the author.<br />The coordinator may add categories and formatting.
                        </p>p>
                
                </main>main>
        </div>div>
      );
}</></div>
