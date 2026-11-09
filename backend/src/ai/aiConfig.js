/**
 * TrekIndia — Centralized AI Provider Configuration
 * Configurable models, rate limits, timeouts, and usage tracking
 */

import dotenv from 'dotenv';
dotenv.config();

export const AI_CONFIG = {
  // Provider configuration (gemini, openai, local)
  provider: process.env.AI_PROVIDER || 'gemini',
  
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    textModel: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash',
    visionModel: process.env.GEMINI_VISION_MODEL || 'gemini-1.5-flash',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    timeoutMs: 25000,
    maxRetries: 2
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    apiBase: 'https://api.openai.com/v1',
    timeoutMs: 25000,
    maxRetries: 2
  },

  // Operational limits & safety constraints
  safety: {
    maxImageUploadSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/avif'],
    rateLimitPerMinute: 30
  },

  // Cost and usage metrics tracking
  metrics: {
    totalCalls: 0,
    failedCalls: 0,
    lastActiveTimestamp: null
  }
};

export default AI_CONFIG;

