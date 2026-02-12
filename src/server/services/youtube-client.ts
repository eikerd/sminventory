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
  title: string;
  description: string;
  channelName: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration: string | null;
  descriptionUrls: string[];
}

export interface ScrapeResult {
  title: string | null;
  description: string | null;
  channelName: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  duration: string | null;
  descriptionUrls: string[];
  source: "data_api" | "oembed";
}

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

async function getGoogleApiKey(): Promise<string | null> {
  const setting = db.select().from(settings).where(eq(settings.key, "google_api_key")).get();
  return setting?.value || process.env.GOOGLE_API_KEY || null;
}

// ---------- oEmbed (free, no API key) ----------

export async function fetchOEmbed(url: string): Promise<OEmbedResult | null> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;
    return response.json();
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
  const key = apiKey || await getGoogleApiKey();
  if (!key) return null;

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${key}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    const item = data.items?.[0];
    if (!item) return null;

    const description = item.snippet?.description || "";
    return {
      title: item.snippet?.title || "",
      description,
      channelName: item.snippet?.channelTitle || "",
      publishedAt: item.snippet?.publishedAt || "",
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.default?.url || "",
      duration: item.contentDetails?.duration || null,
      descriptionUrls: parseDescriptionUrls(description),
    };
  } catch (error) {
    console.error("YouTube Data API fetch failed:", error);
    return null;
  }
}

// ---------- URL parsing ----------

export function parseDescriptionUrls(description: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const matches = description.match(urlRegex) || [];
  // Deduplicate and clean trailing punctuation
  return [...new Set(matches.map(u => u.replace(/[.,;:!?)]+$/, "")))];
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
