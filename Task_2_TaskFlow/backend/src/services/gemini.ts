import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash";

let gemini: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Gemini API key is missing. Add GEMINI_API_KEY to backend/.env."
    );
  }

  if (!gemini) {
    gemini = new GoogleGenAI({ apiKey });
  }

  return gemini;
}

function getStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const value = error as {
    status?: number | string;
    code?: number | string;
    response?: {
      status?: number;
    };
  };

  const status =
    value.status ??
    value.code ??
    value.response?.status;

  const parsed = Number(status);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown Gemini error";
  }
}

function isQuotaError(error: unknown): boolean {
  const status = getStatusCode(error);
  const message = getErrorText(error).toLowerCase();

  return (
    status === 429 ||
    message.includes("quota exceeded") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit")
  );
}

function isTemporaryError(error: unknown): boolean {
  const status = getStatusCode(error);

  return [500, 502, 503, 504].includes(status || 0);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createUserFriendlyError(error: unknown): Error {
  if (isQuotaError(error)) {
    return new Error(
      "Gemini API quota has been exhausted. Please wait for your quota to reset or check your Google AI Studio usage limits."
    );
  }

  const status = getStatusCode(error);

  if (status === 401 || status === 403) {
    return new Error(
      "Gemini API authentication failed. Please check your API key and API access settings."
    );
  }

  if (status === 400) {
    return new Error(
      "Gemini rejected the request. Please check the AI request configuration."
    );
  }

  if (isTemporaryError(error)) {
    return new Error(
      "Gemini is temporarily unavailable due to high demand. Please try again later."
    );
  }

  return new Error(getErrorText(error));
}

async function generateWithModel<T>(
  client: GoogleGenAI,
  model: string,
  systemInstruction: string,
  prompt: string
): Promise<T> {
  const maxAttempts = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Gemini request: model=${model}, attempt=${attempt}/${maxAttempts}`
      );

      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 8192,
        },
      });

      const responseText = response.text;

      if (!responseText) {
        throw new Error("Gemini returned an empty response.");
      }

      try {
        return JSON.parse(responseText) as T;
      } catch {
        console.error("Gemini returned invalid JSON:", responseText);

        throw new Error(
          "The AI generated an invalid response. Please try again."
        );
      }
    } catch (error) {
      lastError = error;

      // Quota errors must never be retried.
      if (isQuotaError(error)) {
        console.error(
          `Gemini quota exhausted for model ${model}. Stopping retries.`
        );

        throw createUserFriendlyError(error);
      }

      // Only retry temporary server errors.
      if (!isTemporaryError(error)) {
        throw error;
      }

      if (attempt < maxAttempts) {
        const delay = 1500 * Math.pow(2, attempt - 1);

        console.warn(
          `Gemini model ${model} is temporarily unavailable. Retrying in ${delay}ms.`
        );

        await wait(delay);
      }
    }
  }

  throw createUserFriendlyError(lastError);
}

export async function generateGeminiJSON<T>(
  systemInstruction: string,
  prompt: string
): Promise<T> {
  const client = getGeminiClient();

  try {
    return await generateWithModel<T>(
      client,
      MODEL,
      systemInstruction,
      prompt
    );
  } catch (primaryError) {
    // Don't attempt another model when the primary model has a quota error.
    if (isQuotaError(primaryError)) {
      throw createUserFriendlyError(primaryError);
    }

    // Fallback is only useful for temporary availability errors.
    if (!isTemporaryError(primaryError)) {
      throw createUserFriendlyError(primaryError);
    }

    if (FALLBACK_MODEL === MODEL) {
      throw createUserFriendlyError(primaryError);
    }

    console.warn(
      `Primary Gemini model ${MODEL} remains unavailable. Switching to fallback model ${FALLBACK_MODEL}.`
    );

    try {
      return await generateWithModel<T>(
        client,
        FALLBACK_MODEL,
        systemInstruction,
        prompt
      );
    } catch (fallbackError) {
      console.error("Gemini primary and fallback models failed.", {
        primaryModel: MODEL,
        fallbackModel: FALLBACK_MODEL,
        primaryError,
        fallbackError,
      });

      // Preserve quota information instead of hiding it.
      if (isQuotaError(fallbackError)) {
        throw createUserFriendlyError(fallbackError);
      }

      throw createUserFriendlyError(fallbackError);
    }
  }
}