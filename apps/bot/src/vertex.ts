/**
 * VERTEX AI (Gemini) via SERVICE ACCOUNT — memakai billing GCP standar (credit $300),
 * beda dari Gemini API/AI Studio yang pakai prepaid terpisah.
 *
 * Auth: tanda tangani JWT (RS256) dari service account → tukar jadi OAuth access
 * token di https://oauth2.googleapis.com/token → panggil endpoint Vertex dgn Bearer.
 * Tanpa dependency tambahan (pakai node:crypto bawaan). Token di-cache ~1 jam.
 *
 * KEAMANAN (OWASP A05): file service account (JSON) = RAHASIA, di-gitignore.
 * Path-nya dari .env (VERTEX_SA_KEY_FILE), tak pernah di-hardcode.
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { config } from './config';
import { logger } from './logger';
import type { ChatMessage } from './session';

/** True bila path service account terisi. */
export const vertexEnabled = config.vertex.keyFile.length > 0;

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string; project_id?: string };

let sa: ServiceAccount | null = null;
function loadSA(): ServiceAccount {
  if (!sa) sa = JSON.parse(readFileSync(config.vertex.keyFile, 'utf8')) as ServiceAccount;
  return sa;
}

const b64url = (s: string): string => Buffer.from(s).toString('base64url');

let cachedToken = '';
let tokenExp = 0; // epoch detik

/** Access token OAuth dari service account (JWT bearer flow), di-cache. */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExp - 60) return cachedToken;

  const s = loadSA();
  const tokenUri = s.token_uri || 'https://oauth2.googleapis.com/token';
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: s.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: tokenUri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = createSign('RSA-SHA256').update(signingInput).sign(s.private_key, 'base64url');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body:
      `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}` +
      `&assertion=${encodeURIComponent(jwt)}`,
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!data.access_token) throw new Error(`Vertex token exchange gagal: ${data.error_description ?? res.status}`);
  cachedToken = data.access_token;
  tokenExp = now + (data.expires_in ?? 3600);
  return cachedToken;
}

/** Panggil Gemini di Vertex AI (generateContent). Role 'assistant' → 'model'. */
export async function callVertex(system: string, messages: ChatMessage[]): Promise<string> {
  const s = loadSA();
  const project = config.vertex.project || s.project_id;
  if (!project) throw new Error('VERTEX_PROJECT_ID kosong & tak ada project_id di service account.');
  const { location, model, maxTokens } = config.vertex;
  const token = await getAccessToken();

  const url =
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}` +
    `/locations/${location}/publishers/google/models/${model}:generateContent`;
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // Timeout biar tak menggantung (model "thinking" seperti *-pro bisa lama).
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Vertex API ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  } finally {
    clearTimeout(timer);
  }
}
