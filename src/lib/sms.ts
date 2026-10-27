/**
 * Arkesel SMS Gateway Integration for Hon. Kwabena Okyere Darko-Mensah (Takoradi MP)
 * Official Sender ID: KOBBYMP
 */

export const DEFAULT_SENDER_ID = "KOBBYMP";

/**
 * Standardize Ghanaian / International phone numbers into standard recipient format
 * Example: '0241234567' -> '233241234567'
 */
export function sanitizePhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/[^\d+]/g, "").trim();
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  // Convert Ghanaian local 10-digit '024xxxxxxx' to '23324xxxxxxx'
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "233" + cleaned.substring(1);
  } else if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }
  return cleaned;
}

/**
 * Query current SMS account credit balance from Arkesel Gateway (V2 with V1 fallback)
 */
export async function getSMSBalance(): Promise<{ success: boolean; balance?: number; user?: string; error?: string }> {
  const apiKey = process.env.ARKESEL_API_KEY || "OmpKdHhGSDdoTkVDclpseHg=";

  // Try V2 Balance Details first
  try {
    const v2Res = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
      headers: { "api-key": apiKey.trim() },
      cache: "no-store",
    });

    if (v2Res.ok) {
      const v2Data = await v2Res.json();
      if (v2Data.status === "success" && v2Data.data) {
        return {
          success: true,
          balance: Number(v2Data.data.sms_balance ?? v2Data.data.balance ?? 0),
          user: "Hon. Kwabena Okyere Darko-Mensah",
        };
      }
    }
  } catch (e) {
    console.warn("[V2 Balance Check Warning - Falling back to V1]:", e);
  }

  // Fallback to V1
  try {
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
 * Send a single SMS via Arkesel v2 (with v1 fallback)
 */
export async function sendSingleSMS(
  recipient: string,
  message: string,
  senderId: string = DEFAULT_SENDER_ID
): Promise<SendSMSResult> {
  const formattedNumber = sanitizePhoneNumber(recipient);
  if (!formattedNumber || formattedNumber.length < 9) {
    return { recipient, success: false, error: "Invalid phone number format" };
  }

  const apiKey = process.env.ARKESEL_API_KEY || "OmpKdHhGSDdoTkVDclpseHg=";

  // Try Arkesel v2 JSON API
  try {
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: senderId || DEFAULT_SENDER_ID,
        message,
        recipients: [formattedNumber],
      }),
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok && data.status === "success") {
      const msgId = Array.isArray(data.data) ? data.data[0]?.id : data.data?.id;
      return {
        recipient: formattedNumber,
        success: true,
        messageId: msgId,
        statusText: "Delivered to gateway",
      };
    }
  } catch (v2Err) {
    console.warn("[V2 Single Send Warning - Trying V1]:", v2Err);
  }

  // Fallback to V1 GET API
  try {
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
    const isSuccess =
      res.ok &&
      (responseText.includes("100") ||
        responseText.toLowerCase().includes("success") ||
        responseText.toLowerCase().includes("successfully"));

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
 * High-speed Arkesel V2 native bulk dispatch
 * Sends to hundreds of recipients in a single HTTP request in < 1 second.
 */
export async function sendArkeselV2Bulk(
  recipients: string[],
  message: string,
  senderId: string = DEFAULT_SENDER_ID,
  callbackUrl?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const apiKey = process.env.ARKESEL_API_KEY || "OmpKdHhGSDdoTkVDclpseHg=";
    const payload: any = {
      sender: senderId || DEFAULT_SENDER_ID,
      message,
      recipients,
    };
    if (callbackUrl) {
      payload.callback_url = callbackUrl;
    }

    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: {
        "api-key": apiKey.trim(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const data = await res.json();
    if (!res.ok || data.status === "error") {
      return {
        success: false,
        error: data.message || `Arkesel Bulk Gateway Error (HTTP ${res.status})`,
      };
    }

    return {
      success: true,
      data: data.data || data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to reach Arkesel bulk SMS gateway",
    };
  }
}

/**
 * Send bulk messages optimized for speed and resilience against timeouts
 */
export async function sendBulkSMS(
  recipients: Array<{ phone: string; name?: string }>,
  messageTemplate: string,
  senderId: string = DEFAULT_SENDER_ID,
  callbackUrl?: string,
  onProgress?: (index: number, total: number, result: SendSMSResult) => void
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: SendSMSResult[];
}> {
  const results: SendSMSResult[] = [];
  const hasPersonalization = /\{name\}/i.test(messageTemplate);

  // OPTIMIZED PATH: No variable personalization - use Native Arkesel V2 Bulk
  // Sends hundreds/thousands of recipients in 1-2 fast requests in < 2s
  if (!hasPersonalization) {
    const CHUNK_SIZE = 400; // Chunk into 400 to respect gateway payload bounds

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      const formattedPhones = chunk.map((r) => sanitizePhoneNumber(r.phone)).filter((p) => p.length >= 9);

      const bulkRes = await sendArkeselV2Bulk(formattedPhones, messageTemplate, senderId, callbackUrl);

      chunk.forEach((target) => {
        const phone = sanitizePhoneNumber(target.phone);
        const res: SendSMSResult = {
          recipient: phone,
          success: bulkRes.success,
          statusText: bulkRes.success ? "Sent to gateway" : "Gateway rejected",
          error: bulkRes.error,
        };
        results.push(res);
        if (onProgress) {
          onProgress(results.length, recipients.length, res);
        }
      });
    }
  } else {
    // PERSONALIZED PATH: Each message has custom constituent name
    // Use concurrent batches of 25 with small delay to avoid gateway overload
    const BATCH_SIZE = 25;
    const DELAY_MS = 80;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (target) => {
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

      if (i + BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      }
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
