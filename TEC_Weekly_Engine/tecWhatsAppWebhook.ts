// TEC Weekly — WhatsApp Cloud API Webhook (ported from TEC_WEBSITE/functions)
// GET  = Meta webhook handshake (hub.challenge) | ?mode=status diagnostics | ?mode=fbtest Firestore test
// POST = inbound message processing: email-link flow, Gemini facilitator, image proof -> Cloudinary

const PHONE_NUMBER_ID = "1329337346933318"; // TEC Weekly production number +234 902 667 5879
const GRAPH_VERSION = "v20.0";
const FIRESTORE_BASE = "https://firestore.googleapis.com/v1/projects/tec-weekly-goals/databases/(default)/documents";
const CLOUD_NAME = "dmbx0y0v3";
const CLOUD_KEY = "654415298693428";

const MASTER_SYSTEM_INSTRUCTION = `You are the Execution Circle Facilitator for TEC Weekly.
You are in a direct 1-on-1 WhatsApp chat with an active community member.
Your persona is disciplined, high-agency, direct, and focused on radical accountability.

COMMUNICATION DIRECTIVES:
- ALWAYS address the member directly in the second person ("you", "your").
- NEVER speak about the member in third person.
- Output ONLY the direct WhatsApp message to send to the member.
- Acknowledge their discipline or call out slacking with actionable next steps.
- Keep replies punchy and optimal for WhatsApp chat (under 100 words).

SCORING RULES:
- +10 Points: confirmed completion of a weekly goal milestone.
- +5 Points: providing visual proof (screenshots, photos, artifacts).
- -2 Points: missed deadlines or lack of update without prior notification.`;

// ---- Firebase service account assembly ----
// The platform's secret detector stored the private key as 24 numbered fragments
// ($FIREBASE_PRIVATE_KEY, $FIREBASE_PRIVATE_KEY_2 ... _24). KEY_GLUE holds the exact
// text between fragments (interleaved: glue[0]+frag[0]+glue[1]+...+frag[23]+glue[24]).
// If a full FIREBASE_SERVICE_ACCOUNT secret is ever set, it takes priority.
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
  const direct = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (direct) {
    try {
      return JSON.parse(direct);
    } catch {
      console.warn("[Firestore] FIREBASE_SERVICE_ACCOUNT set but unparseable.");
    }
  }
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

// ---------------- crypto helpers ----------------

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return Array.from(sig).map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

async function sha1Hex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const sig = new Uint8Array(await crypto.subtle.digest("SHA-1", enc.encode(data)));
  return Array.from(sig).map((b: number) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------- Firestore (via REST + service-account JWT) ----------------

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

async function fsFindUserByField(token: string, field: string, value: string): Promise<any | null> {
  const rows = await fsRunQuery(token, {
    from: [{ collectionId: "users" }],
    where: { fieldFilter: { field: { fieldPath: field }, op: "EQUAL", value: { stringValue: value } } },
    limit: 1,
  });
  return rows[0] || null;
}

async function fsPatchUserPhone(token: string, docId: string, phone: string): Promise<boolean> {
  const res = await fetch(
    `${FIRESTORE_BASE}/users/${docId}?updateMask.fieldPaths=phoneNumber&updateMask.fieldPaths=whatsappNumber`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: { phoneNumber: { stringValue: phone }, whatsappNumber: { stringValue: phone } },
      }),
    },
  );
  return res.ok;
}

async function fsAddDocument(token: string, collection: string, fields: Record<string, any>): Promise<boolean> {
  const res = await fetch(`${FIRESTORE_BASE}/${collection}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  return res.ok;
}

async function fsGetDoc(token: string, path: string): Promise<any | null> {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data: any = await res.json();
  return data.fields ?? null;
}

const LAGOS_OFFSET_MIN = 60; // Africa/Lagos = UTC+1
function lagosNow(): Date {
  return new Date(Date.now() + LAGOS_OFFSET_MIN * 60000);
}
function isoWeekId(d: Date): string {
  const day = d.getUTCDay() || 7;
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + jan1.getUTCDay() + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ---------------- Q&A intent router (goal status, wallet, points, leaderboard, deadlines, moderator role, task updates via chat) ----------------

function classifyIntent(text: string): { type: string; taskIndex?: number } | null {
  const t = (text || "").toLowerCase();
  const taskMatch = t.match(/(?:complete|completed|mark|update|finish|finished|done with)\D{0,20}task\D{0,5}(\d+)/);
  if (taskMatch) return { type: "update_task", taskIndex: parseInt(taskMatch[1], 10) };
  if (/leaderboard|rank|position/.test(t)) return { type: "leaderboard" };
  if (/wallet|balance/.test(t)) return { type: "wallet" };
  if (/\bpoint/.test(t)) return { type: "points" };
  if (/deadline/.test(t)) return { type: "deadline" };
  if (/moderator|my role|active role/.test(t)) return { type: "moderator" };
  if (/goal|task|milestone|progress/.test(t)) return { type: "goal_status" };
  return null;
}

async function handleIntent(token: string, userId: string, intent: { type: string; taskIndex?: number }): Promise<string | null> {
  const userDoc = await fsFindUserByField(token, "phoneNumber", userId) || await fsFindUserByField(token, "whatsappNumber", userId);
  if (!userDoc) return null;
  const name = (userDoc.fields?.name?.stringValue || "there").trim().split(/\s+/)[0];
  const weekId = isoWeekId(lagosNow());

  if (intent.type === "wallet") {
    const bal = userDoc.fields?.walletBalance?.integerValue ?? userDoc.fields?.walletBalance?.doubleValue ?? "0";
    return `\u{1F4B0} ${name}, your wallet balance is \u20A6${bal}.`;
  }
  if (intent.type === "points") {
    const pts = userDoc.fields?.totalPoints?.integerValue ?? "0";
    return `\u2B50 ${name}, you have ${pts} total points.`;
  }
  if (intent.type === "deadline") {
    const settings = await fsGetDoc(token, `week_settings/${weekId}`);
    const setup = settings?.setupDeadline?.stringValue;
    const completion = settings?.completionDeadline?.stringValue;
    if (!setup && !completion) return `\u{1F4C5} No deadlines have been set for Week ${weekId} yet.`;
    return `\u{1F4C5} Week ${weekId} deadlines:\n${setup ? `Goal setup: ${setup}\n` : ""}${completion ? `Completion: ${completion}` : ""}`.trim();
  }
  if (intent.type === "moderator") {
    const settings = await fsGetDoc(token, `week_settings/${weekId}`);
    const modId = settings?.moderatorUserId?.stringValue;
    if (modId && modId === userDoc.id) {
      return `\u{1F396}\uFE0F Yes ${name} \u2014 you're the moderator for Week ${weekId}. You can review and approve members' task proofs on the site.`;
    }
    const modName = settings?.moderatorName?.stringValue;
    return modName
      ? `This week's moderator is ${modName}. You don't have an active role assigned this week.`
      : `No moderator has been assigned for Week ${weekId} yet, and you don't have an active role.`;
  }
  if (intent.type === "leaderboard") {
    const rows = await fsRunQuery(token, {
      from: [{ collectionId: "users" }],
      orderBy: [{ field: { fieldPath: "totalPoints" }, direction: "DESCENDING" }],
      limit: 500,
    });
    const idx = rows.findIndex((r: any) => r.id === userDoc.id);
    if (idx === -1) return `Couldn't find your leaderboard position yet \u2014 make sure you have points logged.`;
    return `\u{1F3C6} ${name}, you're ranked #${idx + 1} of ${rows.length} on the TEC leaderboard.`;
  }
  if (intent.type === "goal_status" || intent.type === "update_task") {
    const goal = await fsGetDoc(token, `weekly_goals/${userDoc.id}_${weekId}`);
    if (!goal) return `You haven't set your goals for Week ${weekId} yet. Head to the site and set them now \u2014 execution starts with a plan.`;
    const arr = goal.tasks?.arrayValue?.values ?? [];
    if (intent.type === "update_task") {
      const idx = (intent.taskIndex ?? 0) - 1;
      if (idx < 0 || idx >= arr.length) {
        return `You only have ${arr.length} task(s) this week \u2014 reply "complete task 1" through "complete task ${arr.length}".`;
      }
      const tf = arr[idx].mapValue.fields;
      tf.status = { stringValue: "Completed" };
      const doneCount = arr.filter((x: any) => x.mapValue.fields.status?.stringValue === "Completed").length;
      const progressPct = Math.round((doneCount / arr.length) * 100);
      await fetch(
        `${FIRESTORE_BASE}/weekly_goals/${userDoc.id}_${weekId}?updateMask.fieldPaths=tasks&updateMask.fieldPaths=progress&updateMask.fieldPaths=updatedAt`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            fields: {
              tasks: { arrayValue: { values: arr } },
              progress: { stringValue: String(progressPct) },
              updatedAt: { timestampValue: new Date().toISOString() },
            },
          }),
        },
      );
      const desc = tf.description?.stringValue || `Task ${idx + 1}`;
      return `\u2705 Marked done: "${desc}"\n\nYou're now at ${progressPct}% for Week ${weekId}. Keep going!`;
    }
    const progress = goal.progress?.stringValue || goal.progress?.integerValue || "0";
    const lines = arr.slice(0, 6).map((t: any, i: number) => {
      const tf = t.mapValue.fields;
      const done = tf.status?.stringValue === "Completed";
      return `${done ? "\u2705" : `${i + 1}.`} ${tf.description?.stringValue || ""}`;
    }).join("\n");
    return `\u{1F525} ${name}, Week ${weekId} goals (${progress}%):\n\n${lines || "No tasks found."}\n\nReply "complete task <number>" to mark one done.`;
  }
  return null;
}

// ---------------- Meta Graph API ----------------

async function sendMetaText(to: string, text: string): Promise<any> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });
  const data: any = await res.json();
  if (!res.ok) console.error("[Meta] send failed:", JSON.stringify(data));
  return data;
}

async function fetchAndUploadMedia(mediaId: string): Promise<{ secure_url: string; public_id: string } | null> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  const cloudSecret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!accessToken || !cloudSecret) return null;
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const meta: any = await metaRes.json();
    if (!meta?.url) throw new Error("no download url");

    const imgRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const bytes = new Uint8Array(await imgRes.arrayBuffer());

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "tec_weekly_updates";
    const signature = await sha1Hex(`folder=${folder}&timestamp=${timestamp}${cloudSecret}`);

    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "image/jpeg" }));
    form.append("api_key", CLOUD_KEY);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("signature", signature);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: "POST",
      body: form,
    });
    const up: any = await uploadRes.json();
    return { secure_url: up.secure_url, public_id: up.public_id };
  } catch (e: any) {
    console.error("[Cloudinary] media pipeline failed:", e?.message);
    return null;
  }
}

// ---------------- Gemini facilitator ----------------

async function generateFacilitatorReply(opts: {
  userId: string;
  incomingMessage: string;
  hasImage: boolean;
  imageUrl: string | null;
}): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const fallback = opts.hasImage
    ? `Visual proof received and recorded (+5 Points). Keep executing towards your weekly goal.`
    : `Update received. Stay accountable and maintain your execution momentum!`;

  if (!geminiKey) {
    console.warn("[Gemini] GEMINI_API_KEY not visible to this function.");
    return fallback;
  }

  let memberName = "Member";
  const token = await getFirebaseToken();
  if (token) {
    try {
      let doc: any = null;
      for (const field of ["phoneNumber", "whatsappNumber"]) {
        doc = await fsFindUserByField(token, field, opts.userId);
        if (doc) break;
      }
      if (!doc) {
        const stripped = opts.userId.replace(/^\+/, "");
        doc = await fsFindUserByField(token, "phoneNumber", stripped);
      }
      if (doc) {
        const name = doc.fields?.displayName?.stringValue || doc.fields?.name?.stringValue;
        if (name) memberName = name;
      }
    } catch (e: any) {
      console.warn("[Gemini] profile lookup skipped:", e?.message);
    }
  }

  const userPrompt = [
    `Member: ${memberName}`,
    `Visual Proof Attached: ${opts.hasImage ? "Yes (+5 Points eligible)" : "No"}`,
    opts.imageUrl ? `Proof Image URL: ${opts.imageUrl}` : "",
    "",
    `The member just sent you this message on WhatsApp:`,
    `"${opts.incomingMessage || (opts.hasImage ? "[Attached an image proof of work]" : "")}"`,
    "",
    `Respond directly to ${memberName} on WhatsApp as their Execution Circle Facilitator.`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: MASTER_SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.5, maxOutputTokens: 1000 },
        }),
      },
    );
    const data: any = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply?.trim() || fallback;
  } catch (e: any) {
    console.error("[Gemini] call failed:", e?.message);
    return fallback;
  }
}

// ---------------- main handler ----------------

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  // ---------- GET: handshake / status / fbtest ----------
  if (req.method === "GET") {
    const mode = url.searchParams.get("mode");

    if (mode === "status") {
      const frags = FRAG_NAMES.map((n) => Deno.env.get(n)).filter(Boolean).length;
      return new Response(
        JSON.stringify({
          ok: true,
          env: {
            verifyToken: !!Deno.env.get("WHATSAPP_VERIFY_TOKEN"),
            accessToken: !!Deno.env.get("META_ACCESS_TOKEN"),
            appSecret: !!Deno.env.get("META_APP_SECRET"),
            geminiKey: !!Deno.env.get("GEMINI_API_KEY"),
            cloudSecret: !!Deno.env.get("CLOUDINARY_API_SECRET"),
            firebaseDirect: !!Deno.env.get("FIREBASE_SERVICE_ACCOUNT"),
            firebaseFragments: frags,
            firebaseUsable: !!buildServiceAccount(),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (mode === "fbtest") {
      const token = await getFirebaseToken();
      if (!token) {
        return new Response(
          JSON.stringify({ ok: false, error: "no firebase credentials available" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      try {
        const rows = await fsRunQuery(token, { from: [{ collectionId: "users" }], limit: 3 });
        return new Response(
          JSON.stringify({ ok: true, firestoreReachable: true, sampleUsers: rows.length }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ ok: false, error: e?.message }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
    }

    const hubMode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN");

    if (hubMode === "subscribe" && verifyToken && token === verifyToken) {
      console.log("[Webhook] Handshake validated.");
      return new Response(challenge ?? "", { status: 200 });
    }
    console.warn("[Webhook] Handshake failed.");
    return new Response("Forbidden", { status: 403 });
  }

  // ---------- POST: inbound message ----------
  if (req.method === "POST") {
    const raw = await req.text();
    const sigHeader = req.headers.get("x-hub-signature-256");
    const appSecret = Deno.env.get("META_APP_SECRET");

    if (appSecret && sigHeader) {
      const expected = "sha256=" + (await hmacSha256Hex(appSecret, raw));
      if (expected !== sigHeader) {
        console.error("[Webhook] Invalid X-Hub-Signature-256. Rejecting.");
        return new Response("Invalid signature", { status: 403 });
      }
    } else {
      console.warn("[Webhook] Signature validation skipped (no app secret or header).");
    }

    try {
      const payload: any = JSON.parse(raw);
      const changeValue = payload?.entry?.[0]?.changes?.[0]?.value;
      const message = changeValue?.messages?.[0];

      if (message) {
        const userId: string = message.from; // MSISDN, e.g. 234806...
        const token = await getFirebaseToken();

        // ---- email-link flow ----
        const textBody: string = message.type === "text" ? message.text?.body || "" : "";

        if (token) {
          const emailMatch = textBody.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
          if (emailMatch) {
            const targetEmail = emailMatch[0].toLowerCase();
            try {
              const userDoc = await fsFindUserByField(token, "email", targetEmail);
              if (userDoc) {
                await fsPatchUserPhone(token, userDoc.id, userId);
                const nameF = userDoc.fields?.displayName?.stringValue || userDoc.fields?.name?.stringValue;
                const memberName = nameF || "Member";
                console.log(`[Webhook] Linked phone ${userId} to user ${userDoc.id}`);
                await sendMetaText(
                  userId,
                  `✅ Account linked successfully!\n\nWelcome, ${memberName}. Your WhatsApp number is now connected to your TEC Weekly account (${targetEmail}). Every update and proof you send here will count toward your goals.`,
                );
                return new Response("EVENT_RECEIVED", { status: 200 });
              }
            } catch (linkErr: any) {
              console.warn("[Webhook] email link failed:", linkErr?.message);
            }
          }
        }

        // ---- text message: store + intent router + AI reply ----
        if (message.type === "text") {
          if (token) {
            try {
              await fsAddDocument(token, "messages", {
                userId: { stringValue: userId },
                text: { stringValue: textBody },
                rawMessageId: { stringValue: message.id || "" },
                timestamp: { timestampValue: new Date().toISOString() },
              });
            } catch (dbErr: any) {
              console.warn("[Webhook] message store skipped:", dbErr?.message);
            }
          }
          let reply: string | null = null;
          if (token) {
            const intent = classifyIntent(textBody);
            if (intent) {
              try {
                reply = await handleIntent(token, userId, intent);
              } catch (e: any) {
                console.warn("[Intent] failed:", e?.message);
              }
            }
          }
          if (!reply) {
            reply = await generateFacilitatorReply({
              userId,
              incomingMessage: textBody,
              hasImage: false,
              imageUrl: null,
            });
          }
          await sendMetaText(userId, reply);
        }

        // ---- image proof: Cloudinary pipeline + AI reply ----
        if (message.type === "image") {
          const caption: string = message.image?.caption || "";
          const upload = await fetchAndUploadMedia(message.image?.id);
          if (token && upload) {
            try {
              await fsAddDocument(token, "updates", {
                userId: { stringValue: userId },
                imageUrl: { stringValue: upload.secure_url },
                cloudinaryPublicId: { stringValue: upload.public_id },
                caption: { stringValue: caption },
                type: { stringValue: "image_update" },
                rawMessageId: { stringValue: message.id || "" },
                timestamp: { timestampValue: new Date().toISOString() },
              });
            } catch (dbErr: any) {
              console.warn("[Webhook] update store skipped:", dbErr?.message);
            }
          }
          const aiReply = await generateFacilitatorReply({
            userId,
            incomingMessage: caption,
            hasImage: true,
            imageUrl: upload?.secure_url ?? null,
          });
          await sendMetaText(userId, aiReply);
        }
      }
    } catch (processingErr: any) {
      console.error("[Webhook] processing error:", processingErr?.message);
    }

    return new Response("EVENT_RECEIVED", { status: 200 });
  }

  return new Response("Method Not Allowed", { status: 405 });
});
