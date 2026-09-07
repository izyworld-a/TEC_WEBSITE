// TEC Weekly — Goal Reminders & Accountability Alerts (scheduled)
// GET  ?mode=dry -> preview the messages that would be sent (no sends)
// POST {}       -> run for real (called by the daily Base44 workflow; {"dry":true} previews)
// Reads Firestore (users / weekly_goals / week_settings / daily_streaks) and sends
// WhatsApp goal reminders via the Meta Cloud API. Report is returned as JSON.

const PHONE_NUMBER_ID = "1329337346933318"; // TEC Weekly production number +234 902 667 5879
const GRAPH_VERSION = "v20.0";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/tec-weekly-goals/databases/(default)/documents";
const LAGOS_OFFSET_MIN = 60; // Africa/Lagos = UTC+1

// ---- Firebase service account assembly (spliced from tecWhatsAppWebhook) ----
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
  for (let i = 0; i < frags.length; i++) {
    pkRaw += frags[i] + KEY_GLUE[i + 1];
  }
  try {
    const privateKey = JSON.parse('"' + pkRaw + '"');
    return {
      type: "service_account",
      project_id: "tec-weekly-goals",
      private_key: privateKey,
      client_email: "firebase-adminsdk-fbsvc@tec-weekly-goals.iam.gserviceaccount.com",
      token_uri: "https://oauth2.googleapis.com/token",
    };
  } catch (e: any) {
    console.warn("[Firestore] key reassembly parse failed:", e?.message);
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

    const b64url = (o: unknown) =>
      btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const claims = {
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    };
    const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url(claims)}`;

    const pemBody = sa.private_key
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, "");
    const der = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "pkcs8",
      der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = new Uint8Array(
      await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
    );
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

// ---------------- helpers ----------------

function lagosNow(): Date {
  return new Date(Date.now() + LAGOS_OFFSET_MIN * 60000);
}

function isoWeekId(d: Date): string {
  const day = d.getUTCDay() || 7; // Mon=1..Sun=7
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function fsGetDoc(token: string, path: string): Promise<any | null> {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data.fields ?? null;
}

function sval(f: any): string {
  if (!f || typeof f !== "object") return "";
  for (const k of ["stringValue", "integerValue", "doubleValue", "booleanValue"]) {
    if (k in f) return String(f[k]);
  }
  return "";
}

function firstName(full: string): string {
  return (full || "there").trim().split(/\s+/)[0];
}

async function sendMetaText(to: string, body: string): Promise<{ ok: boolean; err?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("META_ACCESS_TOKEN") ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { preview_url: false, body },
        }),
      },
    );
    const data: any = await res.json();
    if (data?.messages?.[0]?.id) return { ok: true };
    return { ok: false, err: data?.error?.code ? `${data.error.code}: ${(data.error.error_data?.details || data.error.message || "").slice(0, 90)}` : JSON.stringify(data).slice(0, 90) };
  } catch (e: any) {
    return { ok: false, err: e?.message ?? "network error" };
  }
}

async function runReminders(dry: boolean) {
  const token = await getFirebaseToken();
  if (!token) return { ok: false, error: "Firestore token unavailable" };

  const now = lagosNow();
  const today = now.toISOString().slice(0, 10);
  const weekId = isoWeekId(now);

  const settings = await fsGetDoc(token, `week_settings/${weekId}`);
  const setupDeadline = settings ? sval(settings.setupDeadline) : "";
  const completionDeadline = settings ? sval(settings.completionDeadline) : "";

  const rows = await fsRunQuery(token, {
    from: [{ collectionId: "users" }],
    where: {
      fieldFilter: { field: { fieldPath: "whatsappOptIn" }, op: "EQUAL", value: { booleanValue: true } },
    },
    limit: 500,
  });

  const report: any = { ok: true, weekId, today, optedIn: rows.length, sent: 0, blocked: 0, skipped: 0, results: [] };

  for (const { id, fields } of rows) {
    const name = sval(fields.name);
    const phone = sval(fields.whatsappNumber).replace(/[^0-9]/g, "");
    if (!phone) { report.skipped++; report.results.push({ id, name, note: "no WhatsApp number on file" }); continue; }

    const goal = await fsGetDoc(token, `weekly_goals/${id}_${weekId}`);
    const streak = await fsGetDoc(token, `daily_streaks/${id}`);
    const first = firstName(name);

    let msg = "";
    if (!goal) {
      msg = `\u2600\uFE0F Good morning ${first}! Week ${weekId} is live on TEC and your goals are not set yet.\n\nHead to the portal and lock in your weekly goals now${setupDeadline ? ` \u2014 setup deadline ${setupDeadline}` : ""}.\n\nExecution beats intention. \u{1F525}`;
    } else {
      const progress = parseInt(sval(goal.progress) || "0", 10);
      const tasks: { desc: string; done: boolean }[] = [];
      const arr = goal.tasks?.arrayValue?.values ?? [];
      for (const t of arr.slice(0, 4)) {
        const tf = t?.mapValue?.fields ?? {};
        tasks.push({ desc: sval(tf.description), done: sval(tf.status) === "Completed" });
      }
      const taskLines = tasks.map((t) => `${t.done ? "\u2705" : "\u2022"} ${t.desc}`).join("\n");
      if (progress >= 100) {
        msg = `\u{1F3C6} ${first}, 100% on your Week ${weekId} goals \u2014 elite execution!\n${taskLines}\n\nYour consistency is compounding. Respect.`;
      } else {
        msg = `\u{1F525} ${first}, Week ${weekId} check-in:\n\n${taskLines || "Your goal tasks"}\n\nYou are at ${progress}%${completionDeadline ? ` \u2014 completion deadline ${completionDeadline}` : ""}. Reply here with an update or photo proof. No excuses, execute. \u{1F4AA}`;
      }
    }

    const lastCheckin = streak ? sval(streak.lastCheckin) : "";
    const streakLen = streak ? parseInt(sval(streak.currentStreak) || "0", 10) : 0;
    if (lastCheckin !== today) {
      msg += `\n\nDon't forget today's check-in \u2014 protect that ${streakLen > 0 ? `${streakLen}-day ` : ""}streak \u{1F525}`;
    }

    if (dry) {
      report.results.push({ id, name, phone, preview: msg.slice(0, 140) + "..." });
      continue;
    }
    const r = await sendMetaText(phone, msg);
    if (r.ok) report.sent++;
    else {
      report.blocked++;
      report.results.push({ id, name, phone, error: r.err });
    }
  }
  return report;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let dry = url.searchParams.get("mode") === "dry";
  if (req.method === "POST") {
    const body: any = await req.json().catch(() => ({}));
    if (body?.dry === true) dry = true;
  }
  try {
    const report = await runReminders(dry);
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? "unknown" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
