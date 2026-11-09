/**
 * TrekIndia — Server-side AI Provider Integration Client
 * Handles communication with Gemini API (and alternative providers) securely from the backend.
 * Never exposes credentials to frontend; includes request validation, timeouts, retries, and clean fallbacks.
 */

import { AI_CONFIG } from './aiConfig.js';

/**
 * Make an HTTP request with timeout
 */
async function fetchWithTimeout(url, options, timeoutMs = 25000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/**
 * Execute AI Text Generation
 * @param {string} prompt - User prompt
 * @param {string} systemInstruction - System instruction
 * @returns {Promise<{ success: boolean, content?: string, data?: any, error?: string, providerUsed: string }>}
 */
export async function generateAIText(prompt, systemInstruction = '') {
  AI_CONFIG.metrics.totalCalls++;
  AI_CONFIG.metrics.lastActiveTimestamp = new Date();

  const apiKey = AI_CONFIG.gemini.apiKey;
  if (!apiKey) {
    return {
      success: false,
      error: 'AI_PROVIDER_KEY_NOT_CONFIGURED',
      message: 'AI service API key is not configured in backend environment.',
      providerUsed: 'none'
    };
  }

  const model = AI_CONFIG.gemini.textModel;
  const endpoint = `${AI_CONFIG.gemini.apiBase}/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let attempt = 0;
  const maxRetries = AI_CONFIG.gemini.maxRetries;

  while (attempt <= maxRetries) {
    try {
      const res = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }, AI_CONFIG.gemini.timeoutMs);

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[AI Provider] Gemini API returned status ${res.status}:`, errorText);
        attempt++;
        if (attempt <= maxRetries) {
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        AI_CONFIG.metrics.failedCalls++;
        return {
          success: false,
          error: `AI_API_ERROR_${res.status}`,
          message: 'AI service temporarily unavailable. Please try again.',
          providerUsed: 'gemini'
        };
      }

      const json = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      let parsedData = null;
      try {
        parsedData = JSON.parse(rawText);
      } catch (_) {
        // Fallback for markdown-wrapped json
        const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
        try { parsedData = JSON.parse(clean); } catch (e) { parsedData = null; }
      }

      return {
        success: true,
        content: rawText,
        data: parsedData,
        providerUsed: 'gemini'
      };
    } catch (err) {
      console.warn(`[AI Provider] Attempt ${attempt + 1} failed:`, err.message);
      attempt++;
      if (attempt > maxRetries) {
        AI_CONFIG.metrics.failedCalls++;
        return {
          success: false,
          error: 'AI_NETWORK_TIMEOUT',
          message: 'AI service request timed out. Please check network connection.',
          providerUsed: 'gemini'
        };
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return {
    success: false,
    error: 'AI_SERVICE_UNAVAILABLE',
    message: 'AI service is temporarily unavailable.',
    providerUsed: 'gemini'
  };
}

/**
 * Execute AI Vision Analysis on an image
 * @param {string} base64Data - Clean base64 string (without data:image prefix)
 * @param {string} mimeType - Image mime type
 * @param {string} prompt - Vision analysis prompt
 * @returns {Promise<{ success: boolean, data?: any, content?: string, error?: string, providerUsed: string }>}
 */
export async function generateAIVision(base64Data, mimeType, prompt) {
  AI_CONFIG.metrics.totalCalls++;
  AI_CONFIG.metrics.lastActiveTimestamp = new Date();

  const apiKey = AI_CONFIG.gemini.apiKey;
  if (!apiKey) {
    return {
      success: false,
      error: 'AI_PROVIDER_KEY_NOT_CONFIGURED',
      message: 'AI vision provider API key is not configured in backend environment.',
      providerUsed: 'none'
    };
  }

  const model = AI_CONFIG.gemini.visionModel;
  const endpoint = `${AI_CONFIG.gemini.apiBase}/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json'
    }
  };

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, AI_CONFIG.gemini.timeoutMs);

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[AI Vision] Error response ${res.status}:`, errText);
      AI_CONFIG.metrics.failedCalls++;
      return {
        success: false,
        error: `VISION_API_ERROR_${res.status}`,
        message: 'Mountain vision analysis service returned an error.',
        providerUsed: 'gemini'
      };
    }

    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let parsedData = null;
    try {
      parsedData = JSON.parse(rawText);
    } catch (_) {
      const clean = rawText.replace(/```json\n?|\n?```/g, '').trim();
      try { parsedData = JSON.parse(clean); } catch (e) { parsedData = null; }
    }

    return {
      success: true,
      content: rawText,
      data: parsedData,
      providerUsed: 'gemini'
    };
  } catch (err) {
    console.error('[AI Vision] Exception:', err.message);
    AI_CONFIG.metrics.failedCalls++;
    return {
      success: false,
      error: 'VISION_SERVICE_TIMEOUT',
      message: 'Vision analysis timed out.',
      providerUsed: 'gemini'
    };
  }
}

