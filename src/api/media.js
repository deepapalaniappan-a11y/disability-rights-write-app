/**
 * WordPress.com Media Upload
 * Uploads images and videos to the site's media library
 */

import { SITE_ID, getAuthHeaders } from './auth.js';

const MEDIA_ENDPOINT = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE_ID}/media/new`;

/**
 * Upload a single file to WordPress media library
 * Returns { id, url, width, height, alt, type, mime_type }
 */
export async function uploadMedia(file, token) {
  const formData = new FormData();
  formData.append('media[]', file, file.name);

  const res = await fetch(MEDIA_ENDPOINT, {
    method: 'POST',
    headers: getAuthHeaders(token),
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'Unknown error');
    throw new Error(`Upload failed: ${errText}`);
  }

  const data = await res.json();

  if (data.media && data.media.length > 0) {
    const media = data.media[0];
    const isVideo = media.mime_type && media.mime_type.startsWith('video/');
    return {
      id: media.ID,
      url: media.URL,
      width: media.width,
      height: media.height,
      alt: file.name.replace(/\.[^.]+$/, ''),
      type: isVideo ? 'video' : 'image',
      mime_type: media.mime_type
    };
  }

  throw new Error('Upload completed but no media returned.');
}

/**
 * Upload multiple files in sequence (to avoid overwhelming slow connections)
 * Returns array of uploaded media objects
 * Calls onProgress(completed, total, currentFileName) after each upload
 */
export async function uploadMultipleMedia(files, token, onProgress) {
  const results = [];
  for (let i = 0; i < files.length; i++) {
    const result = await uploadMedia(files[i], token);
    results.push(result);
    if (onProgress) onProgress(i + 1, files.length, files[i].name);
  }
  return results;
}

/**
 * Generate WordPress image block HTML
 */
export function mediaToImageBlock(media) {
  return `<!-- wp:image {"id":${media.id},"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="${media.url}" alt="${media.alt || ''}" class="wp-image-${media.id}"/></figure>
<!-- /wp:image -->`;
}

/**
 * Generate WordPress video block HTML
 */
export function mediaToVideoBlock(media) {
  return `<!-- wp:video {"id":${media.id}} -->
<figure class="wp-block-video"><video controls src="${media.url}"></video></figure>
<!-- /wp:video -->`;
}

/**
 * Generate the right WordPress block based on media type
 */
export function mediaToBlock(media) {
  if (media.type === 'video') {
    return mediaToVideoBlock(media);
  }
  return mediaToImageBlock(media);
}
