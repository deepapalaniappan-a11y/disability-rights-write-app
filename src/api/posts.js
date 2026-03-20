/**
 * WordPress.com Post Creation
 * Creates draft posts via the REST API
 */
import { SITE_ID, getAuthHeaders } from './auth.js';
import { mediaToBlock } from './media.js';

const POST_ENDPOINT = `https://public-api.wordpress.com/rest/v1.1/sites/${SITE_ID}/posts/new`;

/**
 * Map language values to WordPress tag names
 */
const LANGUAGE_TAGS = {
  english: 'English',
  hindi: 'Hindi',
  tamil: 'Tamil'
};

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
 * Build full post content with text and optional media blocks
 * @param {string} storyText - Plain text story
 * @param {Array} uploadedMedia - Array of media objects (images and videos)
 * @returns {string} WordPress block-format HTML
 */
function buildPostContent(storyText, uploadedMedia = []) {
  let content = storyToHtml(storyText);
  // Append media blocks at end (images as wp:image, videos as wp:video)
  if (uploadedMedia.length > 0) {
    content += '\n\n';
    content += uploadedMedia.map(m => mediaToBlock(m)).join('\n\n');
  }
  return content;
}

/**
 * Create a new draft post on WordPress.com
 * @param {Object} params
 * @param {string} params.title - Post title
 * @param {string} params.story - Plain text story content
 * @param {Array} params.media - Array of uploaded media objects
 * @param {number|null} params.featuredImageId - Media ID for featured image
 * @param {string} params.country - Country name typed by the contributor (e.g. "Kenya")
 * @param {string} params.language - Language slug (english, hindi, tamil, or '')
 * @param {string} token - OAuth access token
 * @returns {Object} { id, url, title, status }
 */
export async function createDraftPost(
  { title, story, media = [], featuredImageId = null, country = '', language = '' },
  token
) {
  const content = buildPostContent(story, media);

  const postPayload = {
    title,
    content,
    status: 'draft',
    format: 'standard'
  };

  // Set featured image (drives thumbnail on Stories listing)
  if (featuredImageId) {
    postPayload.featured_image = featuredImageId;
  }

  // Build tags array — language and country both become plain tags
  const tags = [];
  if (language && LANGUAGE_TAGS[language]) {
    tags.push(LANGUAGE_TAGS[language]);
  }
  if (country && country.trim()) {
    tags.push(country.trim());
  }
  if (tags.length > 0) {
    postPayload.tags = tags.join(',');
  }

  const res = await fetch(POST_ENDPOINT, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(token),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(postPayload)
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
