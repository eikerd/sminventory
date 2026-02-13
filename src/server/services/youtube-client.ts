/**
 * YouTube Client
 *
 * Provides methods for:
 * - Extracting video IDs from various YouTube URL formats
 * - Fetching basic metadata via oEmbed (free, no API key)
 * - Fetching rich metadata via YouTube Data API v3 (requires Google API key)
 * - Parsing URLs from video descriptions
 */

import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

// ---------- Types ----------

export interface OEmbedResult {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  provider_url: string;
}

export interface YouTubeVideoDetails {
  // Basic metadata
  title: string;
  description: string;
  channelName: string;
  channelId: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string | null;
  descriptionUrls: string[];

  // Statistics
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;

  // Status
  uploadStatus: string | null;
  privacyStatus: string | null;
  license: string | null;
  embeddable: boolean | null;
  publicStatsViewable: boolean | null;
  madeForKids: boolean | null;

  // Content details
  dimension: string | null;
  definition: string | null;
  caption: boolean | null;
  licensedContent: boolean | null;
  projection: string | null;

  // Topic details
  topicCategories: string[] | null;

  // Recording details
  recordingDate: string | null;
  locationDescription: string | null;
}

// Base metadata fields common to both sources
interface BaseVideoMetadata {
  title: string | null;
  description: string | null;
  channelName: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  descriptionUrls: string[];
}

// oEmbed metadata (free, no API key required)
export interface OEmbedMetadata extends BaseVideoMetadata {
  source: "oembed";
}

// YouTube Data API metadata (requires API key, includes comprehensive stats)
export interface DataApiMetadata extends BaseVideoMetadata {
  source: "data_api";
  channelId: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  uploadStatus: string | null;
  privacyStatus: string | null;
  license: string | null;
  embeddable: boolean | null;
  publicStatsViewable: boolean | null;
  madeForKids: boolean | null;
  dimension: string | null;
  definition: string | null;
  caption: boolean | null;
  licensedContent: boolean | null;
  projection: string | null;
  topicCategories: string[] | null;
  recordingDate: string | null;
  locationDescription: string | null;
}

// Discriminated union type
export type VideoMetadata = OEmbedMetadata | DataApiMetadata;

// Legacy alias for backward compatibility
export type ScrapeResult = VideoMetadata;

// ---------- Video ID Extraction ----------

/**
 * Extract YouTube video ID from various URL formats:
 * - youtube.com/watch?v=ID
 * - youtu.be/ID
 * - youtube.com/embed/ID
 * - youtube.com/v/ID
 * - youtube.com/shorts/ID
 */
export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// ---------- API Key ----------

function getGoogleApiKey(): string | null {
  const setting = db.select().from(settings).where(eq(settings.key, "google_api_key")).get();
  return setting?.value || process.env.GOOGLE_API_KEY || null;
}

// ---------- oEmbed (free, no API key) ----------

export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("YouTube oEmbed fetch failed:", error);
    return null;
  }
}

// ---------- YouTube Data API v3 ----------

export async function fetchVideoDetails(
  videoId: string,
  apiKey?: string
): Promise<YouTubeVideoDetails | null> {
  // Determine API key from parameter, database, or environment
  const key = apiKey || getGoogleApiKey() || process.env.youtube_data_api;
  if (!key) {
    return null;
  }

  try {
    // Request ALL available parts for comprehensive metadata
    const parts = 'snippet,contentDetails,statistics,status,topicDetails,recordingDetails';
    const url = `https://www.googleapis.com/youtube/v3/videos?part=${parts}&id=${videoId}&key=${key}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "Unable to read error body");
      console.warn(
        `YouTube Data API failed (${response.status}): ${errorBody.slice(0, 200)}. Falling back to oEmbed.`
      );
      return null;
    }

    const data = await response.json();
    const item = data.items?.[0];
    if (!item) return null;

    const description = item.snippet?.description || "";
    const snippet = item.snippet || {};
    const contentDetails = item.contentDetails || {};
    const statistics = item.statistics || {};
    const status = item.status || {};
    const topicDetails = item.topicDetails || {};
    const recordingDetails = item.recordingDetails || {};

    return {
      // Basic metadata
      title: snippet.title || "",
      description,
      channelName: snippet.channelTitle || "",
      channelId: snippet.channelId || "",
      publishedAt: snippet.publishedAt || "",
      thumbnailUrl:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.standard?.url ||
        snippet.thumbnails?.default?.url || "",
      duration: contentDetails.duration || null,
      descriptionUrls: parseDescriptionUrls(description),

      // Statistics
      viewCount: statistics.viewCount ? parseInt(statistics.viewCount, 10) : null,
      likeCount: statistics.likeCount ? parseInt(statistics.likeCount, 10) : null,
      commentCount: statistics.commentCount ? parseInt(statistics.commentCount, 10) : null,

      // Status
      uploadStatus: status.uploadStatus || null,
      privacyStatus: status.privacyStatus || null,
      license: status.license || null,
      embeddable: status.embeddable ?? null,
      publicStatsViewable: status.publicStatsViewable ?? null,
      madeForKids: status.madeForKids ?? null,

      // Content details
      dimension: contentDetails.dimension || null,
      definition: contentDetails.definition || null,
      caption: contentDetails.caption === 'true' ? true : contentDetails.caption === 'false' ? false : null,
      licensedContent: contentDetails.licensedContent ?? null,
      projection: contentDetails.projection || null,

      // Topic details
      topicCategories: topicDetails.topicCategories || null,

      // Recording details
      recordingDate: recordingDetails.recordingDate || null,
      locationDescription: recordingDetails.locationDescription || null,
    };
  } catch (error) {
    console.error("YouTube Data API fetch failed:", error);
    return null;
  }
}

// ---------- URL parsing ----------

// Trusted domains for model/resource URLs
const TRUSTED_DOMAINS = [
  'civitai.com',
  'huggingface.co',
  'github.com',
  'patreon.com',
  'ko-fi.com',
  'buymeacoffee.com',
  'discord.gg',
  'discord.com',
];

function isTrustedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '');
    return TRUSTED_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export function parseDescriptionUrls(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const matches = description.match(urlRegex) || [];
  // Deduplicate, clean trailing punctuation, and filter to trusted domains only
  const cleaned = matches.map(u => u.replace(/[.,;:!?)]+$/, ""));
  return [...new Set(cleaned)].filter(isTrustedUrl);
}

// ---------- Combined scrape function ----------

export async function scrapeVideoMetadata(videoUrl: string): Promise<ScrapeResult> {
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    throw new Error("Could not extract video ID from URL");
  }

  // Try YouTube Data API first (richer data)
  const details = await fetchVideoDetails(videoId);
  if (details) {
    return { ...details, source: "data_api" };
  }

  // Fallback to oEmbed (basic info, no API key required)
  const oembed = await fetchOEmbed(videoUrl);
  return {
    title: oembed?.title || null,
    description: null,
    channelName: oembed?.author_name || null,
    publishedAt: null,
    thumbnailUrl: oembed?.thumbnail_url || null,
    duration: null,
    descriptionUrls: [],
    source: "oembed",
  };
}
