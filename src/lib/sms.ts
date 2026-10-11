/**
 * Arkesel SMS Gateway Integration for Hon. Kwabena Okyere Darko-Mensah (Takoradi MP)
 * Official Sender ID: KOBBYMP
 */

export const DEFAULT_SENDER_ID = "KOBBYMP";

/**
 * Standardize Ghanaian / International phone numbers into standard recipient format
 * Example: '0241234567' -> '0241234567' or '233241234567' (Arkesel accepts both)
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  // Convert standard Ghanaian local 024xxxxxxx to 23324xxxxxxx if needed, or keep 10-digit
  return cleaned;
}

/**
 * Query current SMS account credit balance from Arkesel Gateway
 */
export async function getSMSBalance(): Promise<{ success: boolean; balance?: number; user?: string; error?: string }> {
  try {
    const apiKey = process.env.ARKESEL_API_KEY || "OmpKdHhGSDdoTkVDclpseHg=";
    const url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey.trim())}&response=json`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return { success: false, error: `Balance check failed: HTTP ${res.status}` };
    }

    const data = await res.json();
    if (typeof data.balance !== "undefined") {
      return {
        success: true,
        balance: Number(data.balance),
        user: data.user || "Takoradi MP Office",
      };
    }
    return { success: false, error: "Unexpected balance response structure" };
  } catch (err: any) {
    console.error("[SMS Balance Error]:", err);
    return { success: false, error: err.message || "Failed to fetch balance" };
  }
}

export interface SendSMSResult {
  recipient: string;
  success: boolean;
  messageId?: string;
  statusText?: string;
  error?: string;
}

/**
 * Send a single SMS via Arkesel GET gateway
 */
export async function sendSingleSMS(
  recipient: string,
  message: string,
  senderId: string = DEFAULT_SENDER_ID
): Promise<SendSMSResult> {
  const formattedNumber = sanitizePhoneNumber(recipient);
  if (!formattedNumber) {
    return { recipient, success: false, error: "Invalid phone number format" };
  }

  try {
    const apiKey = process.env.ARKESEL_API_KEY || "OmpKdHhGSDdoTkVDclpseHg=";
    const url = new URL("https://sms.arkesel.com/sms/api");
    url.searchParams.set("action", "send-sms");
    url.searchParams.set("api_key", apiKey.trim());
    url.searchParams.set("to", formattedNumber);
    url.searchParams.set("from", senderId || DEFAULT_SENDER_ID);
    url.searchParams.set("sms", message);

    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const responseText = await res.text();

    if (!res.ok) {
      return {
        recipient: formattedNumber,
        success: false,
        error: `HTTP ${res.status}: ${responseText}`,
      };
    }

    // Check Arkesel common response formats (Code 100 or success message or JSON)
    const isSuccess =
      responseText.includes("100") ||
      responseText.toLowerCase().includes("success") ||
      responseText.toLowerCase().includes("successfully");

    return {
      recipient: formattedNumber,
      success: isSuccess,
      statusText: responseText.trim(),
      error: !isSuccess ? responseText.trim() : undefined,
    };
  } catch (err: any) {
    return {
      recipient: formattedNumber,
      success: false,
      error: err.message || "Network exception while contacting SMS gateway",
    };
  }
}

/**
 * Send bulk messages with batch concurrency and pacing to avoid gateway throttling
 */
export async function sendBulkSMS(
  recipients: Array<{ phone: string; name?: string }>,
  messageTemplate: string,
  senderId: string = DEFAULT_SENDER_ID,
  onProgress?: (index: number, total: number, result: SendSMSResult) => void
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: SendSMSResult[];
}> {
  const results: SendSMSResult[] = [];
  const BATCH_SIZE = 15;
  const DELAY_MS = 200;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (target) => {
      // Personalized tag replacement: {name}
      const personalizedMessage = target.name
        ? messageTemplate.replace(/\{name\}/gi, target.name)
        : messageTemplate.replace(/\{name\}/gi, "Constituent");

      const res = await sendSingleSMS(target.phone, personalizedMessage, senderId);
      if (onProgress) {
        onProgress(results.length + 1, recipients.length, res);
      }
      return res;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Minor delay between batches
    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.length - successful;

  return {
    total: results.length,
    successful,
    failed,
    results,
  };
}

/**
 * Helper to calculate SMS page counts and character statistics
 */
export function calculateSMSDetails(text: string) {
  const length = text.length;
  if (length === 0) return { characters: 0, pages: 0, remainingInPage: 160 };

  // Check for unicode / non-GSM characters
  const isUnicode = /[^\u0000-\u00ff]/.test(text);
  const singleLimit = isUnicode ? 70 : 160;
  const multiLimit = isUnicode ? 67 : 153;

  if (length <= singleLimit) {
    return {
      characters: length,
      pages: 1,
      remainingInPage: singleLimit - length,
      isUnicode,
    };
  }

  const pages = Math.ceil(length / multiLimit);
  const remainingInPage = pages * multiLimit - length;

  return {
    characters: length,
    pages,
    remainingInPage,
    isUnicode,
  };
}
