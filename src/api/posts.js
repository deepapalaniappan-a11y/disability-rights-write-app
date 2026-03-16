/**
 * WordPress.com Post Creation
 * Creates draft posts via the REST API
 */

import { SITE_ID, getAuthHeaders } from './auth.js';
import { mediaToImageBlock } from './media.js';

const POST_ENDPOINT = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE_ID}/posts/new`;

/**
 * Convert plain text story content to HTML paragraphs
 * Preserves line breaks as paragraph boundaries
 */
function storyToHtml(text) {
  return text
    .split(/\n\s*\n/)
    .filter(p => p.trim())
    .map(p => `<p>${p.trim().replace(/\n/g, '<br />')}</p>`)
    .join('\n\n');
}

/**
 * Build full post content with text and optional images
 * @param {string} storyText - Plain text story
 * @param {Array} uploadedMedia - Array of { id, url, width, height, alt }
 * @returns {string} WordPress block-format HTML
 */
function buildPostContent(storyText, uploadedMedia = []) {
  let content = storyToHtml(storyText);

  // Append images at the end of the post
  if (uploadedMedia.length > 0) {
    content += '\n\n';
    content += uploadedMedia.map(m => mediaToImageBlock(m)).join('\n\n');
  }

  return content;
}

/**
 * Create a new draft post on WordPress.com
 * @param {Object} params
 * @param {string} params.title - Post title
 * @param {string} params.story - Plain text story content
 * @param {Array} params.media - Array of uploaded media objects (from uploadMedia)
 * @param {string} token - OAuth access token
 * @returns {Object} { id, url, title, status }
 */
export async function createDraftPost({ title, story, media = [] }, token) {
  const content = buildPostContent(story, media);

  const res = await fetch(POST_ENDPOINT, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: title,
      content: content,
      status: 'draft',
      format: 'standard'
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Could not publish your story. Please try again.');
  }

  const data = await res.json();

  return {
    id: data.ID,
    url: data.URL,
    title: data.title,
    status: data.status
  };
}
