// TEC Weekly — Admin-triggered WhatsApp notifications
// POST { type: "moderator_assigned", userId, weekId }              -> pings the newly assigned moderator
// POST { type: "meeting_reminder", when: "Wednesday 9:00 PM", message? } -> sends to every opted-in member
// POST { type: "deadline_update", weekId, setupDeadline?, completionDeadline? } -> broadcasts new deadlines
// POST { type: "announcement", message, category? } -> broadcasts an announcement
// Note: WhatsApp Business Cloud API cannot post into a personal/consumer WhatsApp group chat —
// this is a hard Meta platform restriction, not a config gap. "Group" reminders are delivered as
// individual 1:1 messages to every member with whatsappOptIn = true instead.

const PHONE_NUMBER_ID = "1329337346933318"; // TEC Weekly production number +234 902 667 5879
const GRAPH_VERSION = "v20.0";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/tec-weekly-goals/databases/(default)/documents";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// ---- Firebase service account assembly (same fragment scheme as tecWhatsAppWebhook / tecGoalReminders) ----
const FRAG_NAMES = [
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PRIVATE_KEY_2", "FIREBASE_PRIVATE_KEY_3", "FIREBASE_PRIVATE_KEY_4",
  "FIREBASE_PRIVATE_KEY_5", "FIREBASE_PRIVATE_KEY_6", "FIREBASE_PRIVATE_KEY_7",
  "FIREBASE_PRIVATE_KEY_8", "FIREBASE_PRIVATE_KEY_9", "FIREBASE_PRIVATE_KEY_10",
  "FIREBASE_PRIVATE_KEY_11", "FIREBASE_PRIVATE_KEY_12", "FIREBASE_PRIVATE_KEY_13",
  "FIREBASE_PRIVATE_KEY_14", "FIREBASE_PRIVATE_KEY_15", "FIREBASE_PRIVATE_KEY_16",
  "FIREBASE_PRIVATE_KEY_17", "FIREBASE_PRIVATE_KEY_18", "FIREBASE_PRIVATE_KEY_19",
  "FIREBASE_PRIVATE_KEY_20", "FIREBASE_PRIVATE_KEY_21", "FIREBASE_PRIVATE_KEY_22",
  "FIREBASE_PRIVATE_KEY_23", "FIREBASE_PRIVATE_KEY_24",
];

const KEY_GLUE: string[] = [
  "-----BEGIN PRIVATE KEY-----\\", "\\",
  "+r6XlpOkrkN\\nbnwpVqK/rp0BxENSgcA1jN/", "/oGUJgyGs39C\\",
  "/CZf//o\\nDr6IHNmEKgBEnMjmesqy+YpMRK+", "+\\", "\\",
  "/zO3TZ7\\noIYDXLKVoV1XfR9aH/4iuCrWEs62JWi9MVj/w+zB9ZA+/lOK/TAn/CS+Q02VIdQD\\nTldvqC8Be/",
  "+piOvxA3OZ2vnUJjpL+UcE4\\", "/kTMODjj4gqqNp2xEE4K\\nTUCHemcofQOb+WxQWq5NOoRkahKKiS/",
  "\\n2+dL4OMW7DPpctvR8id+", "\\n6+",
  "/622NRzuHaWrOEy5\\nHYBIZPh+5UEs2PwOPD+BXEwAm6fYFNOKkFrHq/SjxQt3JPxL+pM/HvAYrXTsIJ4p\\nn0Pcev1yZoNUce/XK/",
  "+jxUUOHxepsczHwW\\", "/pdCtyAG1c\\nDYBCA4nDdyutif0wqYtr3/BjZQejRjmXX9dqqAcpdj/eZDnI9b8n1FVAz3BzoNda\\n7F7Dj0n/",
  "+wss9/4OWyQWn6FjznSdYuk4V\\", "\\", "+", "\\", "\\", "\\", "/", "\\",
  "+N7dGoJjcbMweIUAyUG/REcj463jv7jpHyRo\\", "\\nE8H3Zh5tkhyQdGE1rsdClw==\\n-----END PRIVATE KEY-----\\n",
];

function buildServiceAccount(): any | null {
  const frags: (string | null)[] = FRAG_NAMES.map((n) => Deno.env.get(n));
  if (frags.some((f) => !f) || KEY_GLUE.length !== frags.length + 1) return null;
  let pkRaw = KEY_GLUE[0];
  for (let i = 0; i < frags.length; i++) pkRaw += frags[i] + KEY_GLUE[i + 1];
  try {
    const privateKey = JSON.parse('"' + pkRaw + '"');
    return {
      type: "service_account",
      project_id: "tec-weekly-goals",
      private_key: privateKey,
      client_email: "firebase-adminsdk-fbsvc@tec-weekly-goals.iam.gserviceaccount.com",
      token_uri: "https://oauth2.googleapis.com/token",
    };
  } catch {
    return null;
  }
}

let cachedFbToken: { token: string; exp: number } | null = null;

async function getFirebaseToken(): Promise<string | null> {
  const sa = buildServiceAccount();
  if (!sa) return null;
  try {
    const now = Math.floor(Date.now() / 1000);
    if (cachedFbToken && cachedFbToken.exp > now + 60) return cachedFbToken.token;
    const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const claims = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };
    const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}`;
    const pemBody = sa.private_key.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s/g, "");
    const der = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
    const sigB64 = btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = `${unsigned}.${sigB64}`;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    const data: any = await res.json();
    if (!data.access_token) throw new Error(data.error_description || "token exchange failed");
    cachedFbToken = { token: data.access_token, exp: now + 3500 };
    return data.access_token;
  } catch (e: any) {
    console.warn("[Firestore] token failed:", e?.message);
    return null;
  }
}

async function fsGetDoc(token: string, path: string): Promise<any | null> {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data.fields ?? null;
}

async function fsRunQuery(token: string, structuredQuery: any): Promise<any[]> {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  const rows: any[] = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((r: any) => r.document)
    .map((r: any) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields }));
}

async function sendMetaText(to: string, body: string): Promise<{ ok: boolean; err?: string; code?: number }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("META_ACCESS_TOKEN") ?? ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body } }),
    });
    const data: any = await res.json();
    if (data?.messages?.[0]?.id) return { ok: true };
    const code: number | undefined = data?.error?.code;
    return {
      ok: false,
      code,
      err: code
        ? `${code}: ${(data?.error?.error_data?.details || data?.error?.message || "").slice(0, 90)}`
        : JSON.stringify(data).slice(0, 120),
    };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? "network error" };
  }
}

async function sendMetaTemplate(
  to: string,
  templateName: string,
  components: any[] = [],
  languageCode = "en_US",
): Promise<{ ok: boolean; err?: string; code?: number }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("META_ACCESS_TOKEN") ?? ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
    const data: any = await res.json();
    if (data?.messages?.[0]?.id) return { ok: true };
    const code: number | undefined = data?.error?.code;
    return {
      ok: false,
      code,
      err: code
        ? `${code}: ${(data?.error?.error_data?.details || data?.error?.message || "").slice(0, 90)}`
        : JSON.stringify(data).slice(0, 120),
    };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? "network error" };
  }
}

async function sendOutboundNotification({
  phone,
  textMessage,
  templateName,
  templateComponents,
  languageCode = "en_US",
}: {
  phone: string;
  textMessage: string;
  templateName?: string;
  templateComponents?: any[];
  languageCode?: string;
}): Promise<{ ok: boolean; err?: string; channel: "template" | "text" }> {
  // Try template first if templateName provided (bypasses 24h window constraint)
  if (templateName) {
    const tRes = await sendMetaTemplate(phone, templateName, templateComponents || [], languageCode);
    if (tRes.ok) {
      return { ok: true, channel: "template" };
    }
    // If template doesn't exist on Meta yet (132001), log and fall back to freeform text
    console.warn(`[tecNotifyEvent] Template '${templateName}' send failed (${tRes.err}), falling back to text.`);
  }

  // Fallback to text message
  const textRes = await sendMetaText(phone, textMessage);
  return { ok: textRes.ok, err: textRes.err, channel: "text" };
}

async function handleModeratorAssigned(token: string, userId: string, weekId: string) {
  const fields = await fsGetDoc(token, `users/${userId}`);
  if (!fields) return { ok: false, error: "user not found" };
  const phone = (fields.whatsappNumber?.stringValue || fields.phoneNumber?.stringValue || "").replace(/[^0-9]/g, "");
  if (!phone) return { ok: false, error: "no whatsapp number on file" };
  const name = (fields.name?.stringValue || "there").trim().split(/\s+/)[0];
  const msg = `\u{1F396}\uFE0F ${name}, you've been assigned *moderator* for Week ${weekId} on TEC Weekly!\n\nYou can now review and approve members' task proofs on the site. Reply here anytime if you need the current roster.`;
  
  const templateName = Deno.env.get("META_MODERATOR_TEMPLATE") || "moderator_assigned";
  const templateComponents = [
    {
      type: "body",
      parameters: [
        { type: "text", text: name },
        { type: "text", text: `Week ${weekId}` },
      ],
    },
  ];

  const r = await sendOutboundNotification({
    phone,
    textMessage: msg,
    templateName,
    templateComponents,
  });
  return { ok: r.ok, error: r.err, channel: r.channel };
}

async function handleMeetingReminder(token: string, when: string, customMessage?: string) {
  const rows = await fsRunQuery(token, {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: "whatsappOptIn" }, op: "EQUAL", value: { booleanValue: true } } },
    limit: 500,
  });
  const templateName = Deno.env.get("META_MEETING_TEMPLATE") || "meeting_reminder";
  let sent = 0, blocked = 0;
  const deliveryChannels: { [key: string]: number } = { template: 0, text: 0 };

  for (const { fields } of rows) {
    const phone = (fields.whatsappNumber?.stringValue || "").replace(/[^0-9]/g, "");
    if (!phone) continue;
    const name = (fields.name?.stringValue || "there").trim().split(/\s+/)[0];
    const msg = customMessage || `\u{1F5D3}\uFE0F Reminder: TEC Weekly meeting is today at ${when}. Be there and bring your updates!`;
    const templateComponents = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: when },
        ],
      },
    ];

    const r = await sendOutboundNotification({
      phone,
      textMessage: msg,
      templateName,
      templateComponents,
    });
    if (r.ok) {
      sent++;
      deliveryChannels[r.channel] = (deliveryChannels[r.channel] || 0) + 1;
    } else {
      blocked++;
    }
  }
  return { ok: true, sent, blocked, total: rows.length, channels: deliveryChannels };
}

async function handleDeadlineUpdate(token: string, weekId: string, setupDeadline?: string, completionDeadline?: string): Promise<any> {
  const rows = await fsRunQuery(token, {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: "whatsappOptIn" }, op: "EQUAL", value: { booleanValue: true } } },
    limit: 500,
  });
  const fmt = (iso?: string) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
    } catch { return iso; }
  };
  const parts: string[] = [];
  const s = fmt(setupDeadline), c = fmt(completionDeadline);
  if (s) parts.push(`\u{23F3} Set your goals by *${s}*`);
  if (c) parts.push(`\u{1F4DD} Complete all tasks by *${c}*`);
  if (!parts.length) return { ok: false, error: "no deadlines provided" };
  const msg = `\u{23F0}\uFE0F *Deadline Update \u2014 Week ${weekId || "this week"}*\n\n${parts.join("\n")}\n\nCheck the TEC Weekly site for details.`;
  const templateName = Deno.env.get("META_DEADLINE_TEMPLATE") || "deadline_alert";

  let sent = 0, blocked = 0;
  const deliveryChannels: { [key: string]: number } = { template: 0, text: 0 };

  for (const { fields } of rows) {
    const phone = (fields.whatsappNumber?.stringValue || "").replace(/[^0-9]/g, "");
    if (!phone) continue;
    const name = (fields.name?.stringValue || "there").trim().split(/\s+/)[0];
    const templateComponents = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: `Week ${weekId || "Current"}` },
          { type: "text", text: s || c || "Sunday 11:59 PM" },
        ],
      },
    ];

    const r = await sendOutboundNotification({
      phone,
      textMessage: msg,
      templateName,
      templateComponents,
    });
    if (r.ok) {
      sent++;
      deliveryChannels[r.channel] = (deliveryChannels[r.channel] || 0) + 1;
    } else {
      blocked++;
    }
  }
  return { ok: true, sent, blocked, total: rows.length, channels: deliveryChannels };
}

async function handleAnnouncement(token: string, message: string, category?: string): Promise<any> {
  const rows = await fsRunQuery(token, {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: "whatsappOptIn" }, op: "EQUAL", value: { booleanValue: true } } },
    limit: 500,
  });
  const label = category && category !== "General" ? ` (${category})` : "";
  const msg = `\u{1F4E3} *TEC Weekly Announcement${label}*\n\n${message}`;
  const templateName = Deno.env.get("META_ANNOUNCEMENT_TEMPLATE") || "tec_announcement";

  let sent = 0, blocked = 0;
  const deliveryChannels: { [key: string]: number } = { template: 0, text: 0 };

  for (const { fields } of rows) {
    const phone = (fields.whatsappNumber?.stringValue || "").replace(/[^0-9]/g, "");
    if (!phone) continue;
    const name = (fields.name?.stringValue || "there").trim().split(/\s+/)[0];
    const templateComponents = [
      {
        type: "body",
        parameters: [
          { type: "text", text: name },
          { type: "text", text: category || "Announcement" },
          { type: "text", text: message.slice(0, 500) },
        ],
      },
    ];

    const r = await sendOutboundNotification({
      phone,
      textMessage: msg,
      templateName,
      templateComponents,
    });
    if (r.ok) {
      sent++;
      deliveryChannels[r.channel] = (deliveryChannels[r.channel] || 0) + 1;
    } else {
      blocked++;
    }
  }
  return { ok: true, sent, blocked, total: rows.length, channels: deliveryChannels };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });

  const body: any = await req.json().catch(() => ({}));
  const token = await getFirebaseToken();
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "Firestore token unavailable" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }

  try {
    let result: any;
    if (body.type === "moderator_assigned") {
      result = await handleModeratorAssigned(token, body.userId, body.weekId || "");
    } else if (body.type === "meeting_reminder") {
      result = await handleMeetingReminder(token, body.when || "9:00 PM", body.message);
    } else if (body.type === "deadline_update") {
      result = await handleDeadlineUpdate(token, body.weekId || "", body.setupDeadline, body.completionDeadline);
    } else if (body.type === "announcement") {
      result = await handleAnnouncement(token, String(body.message || "").slice(0, 900), body.category);
    } else {
      result = { ok: false, error: "unknown type" };
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "unknown" }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
