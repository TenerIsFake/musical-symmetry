import { getDb } from '../auth/db.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://symmetry.tendrid.us';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Musical Symmetry <noreply@tendrid.us>';

export interface SetClassOfWeek {
  forteNumber: string;
  primeForm: string;
  intervalVector: string;
  description: string;
  funFact: string;
}

export interface UserDigestStats {
  userId: string;
  email: string;
  name: string | null;
  classifications: number;
  analyses: number;
  voiceLeadingCalculations: number;
}

const CURATED_SET_CLASSES: SetClassOfWeek[] = [
  {
    forteNumber: '3-11',
    primeForm: '[0,3,7]',
    intervalVector: '<001110>',
    description: 'The minor triad — one of Western music\'s most fundamental sonorities.',
    funFact: 'Its complement, the major triad (3-11B), shares the same interval vector, making them Z-related twins that sound completely different.',
  },
  {
    forteNumber: '3-12',
    primeForm: '[0,4,8]',
    intervalVector: '<000300>',
    description: 'The augmented triad — three equal intervals dividing the octave symmetrically.',
    funFact: 'Only 4 distinct augmented triads exist (vs. 12 major triads) because of its perfect symmetry — transposing by 4 semitones returns the same pitch classes.',
  },
  {
    forteNumber: '4-28',
    primeForm: '[0,3,6,9]',
    intervalVector: '<004002>',
    description: 'The fully diminished seventh chord — maximally symmetric, dividing the octave into four equal parts.',
    funFact: 'Because of its symmetry there are only 3 distinct diminished seventh chords. Liszt exploited this for seamless modulation to any key.',
  },
  {
    forteNumber: '6-35',
    primeForm: '[0,2,4,6,8,10]',
    intervalVector: '<060603>',
    description: 'The whole-tone scale — Debussy\'s signature sound, built entirely from whole steps.',
    funFact: 'Only 2 distinct whole-tone scales exist. Every interval is either a whole step or its multiples, giving it an unmoored, floating quality.',
  },
  {
    forteNumber: '5-35',
    primeForm: '[0,2,4,7,9]',
    intervalVector: '<032140>',
    description: 'The pentatonic scale — arguably the most universal scale across world music traditions.',
    funFact: 'Found in Scottish folk music, West African drumming, and East Asian classical music alike. Its lack of semitones makes every note consonant with every other.',
  },
  {
    forteNumber: '7-35',
    primeForm: '[0,1,3,5,6,8,10]',
    intervalVector: '<254361>',
    description: 'The diatonic collection — the seven-note foundation of Western tonal music.',
    funFact: 'It is the complement of the pentatonic scale (5-35). Its rotational modes (Dorian, Phrygian, etc.) each produce distinct emotional characters.',
  },
  {
    forteNumber: '4-19',
    primeForm: '[0,1,4,8]',
    intervalVector: '<101310>',
    description: 'The minor-major seventh chord — a brooding, jazz-inflected sonority.',
    funFact: 'Appears prominently in film noir scores and in Ravel\'s harmonic language. The clash between minor third and major seventh creates productive tension.',
  },
  {
    forteNumber: '6-20',
    primeForm: '[0,1,4,5,8,9]',
    intervalVector: '<303630>',
    description: 'The hexatonic scale — Nicolas Slonimsky\'s "Prometheus" hexachord.',
    funFact: 'Richard Cohn\'s neo-Riemannian theory uses this set\'s two augmented-triad subsets to model smooth voice-leading between distantly related triads.',
  },
  {
    forteNumber: '3-5',
    primeForm: '[0,1,6]',
    intervalVector: '<100011>',
    description: 'The tritone-semitone trichord — a hallmark of atonal expressionism.',
    funFact: 'The tritone (6 semitones) was called "diabolus in musica" in medieval theory. Paired with a semitone, this set is a favorite in Schoenberg and Berg.',
  },
  {
    forteNumber: '8-28',
    primeForm: '[0,1,3,4,6,7,9,10]',
    intervalVector: '<448444>',
    description: 'The octatonic scale (diminished scale) — alternating whole and half steps.',
    funFact: 'Rimsky-Korsakov and Stravinsky built entire passages from this scale. Messiaen called it his "second mode of limited transposition" — only 3 distinct versions exist.',
  },
];

export function getSetClassOfTheWeek(): SetClassOfWeek {
  // Use ISO week number for consistent weekly rotation
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNumber = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return CURATED_SET_CLASSES[weekNumber % CURATED_SET_CLASSES.length];
}

export function runDigestMigration(): void {
  const db = getDb();

  // Add digest_optout column if not present
  try {
    db.exec('ALTER TABLE users ADD COLUMN digest_optout INTEGER DEFAULT 0');
  } catch {
    // Column already exists — safe to ignore
  }

  // Add last_digest_sent column to track when we last sent
  try {
    db.exec('ALTER TABLE users ADD COLUMN last_digest_sent TEXT');
  } catch {
    // Column already exists — safe to ignore
  }

  // Create a table to track global digest sends
  db.exec(`
    CREATE TABLE IF NOT EXISTS digest_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sent_at TEXT DEFAULT (datetime('now')),
      recipients INTEGER NOT NULL,
      status TEXT NOT NULL
    )
  `);
}

interface ActiveUser {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  digest_optout: number;
}

interface UsageRow {
  endpoint: string;
  count: number;
}

function getUserWeeklyStats(userId: string): UserDigestStats | null {
  const db = getDb();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  const user = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId) as Pick<ActiveUser, 'id' | 'email' | 'name'> | undefined;
  if (!user) return null;

  const rows = db.prepare(`
    SELECT endpoint, COUNT(*) as count
    FROM api_usage
    WHERE user_id = ? AND timestamp >= ?
    GROUP BY endpoint
  `).all(userId, since) as UsageRow[];

  const byEndpoint: Record<string, number> = {};
  for (const row of rows) {
    byEndpoint[row.endpoint] = row.count;
  }

  const classifications =
    (byEndpoint['classify'] || 0) +
    (byEndpoint['batch'] || 0);

  const analyses = byEndpoint['analyze'] || 0;

  const voiceLeadingCalculations =
    (byEndpoint['og'] || 0) +
    (byEndpoint['voice-leading'] || 0);

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    classifications,
    analyses,
    voiceLeadingCalculations,
  };
}

function buildDigestHtml(stats: UserDigestStats, setClass: SetClassOfWeek, unsubToken: string): string {
  const totalActions = stats.classifications + stats.analyses + stats.voiceLeadingCalculations;
  const unsubUrl = `${APP_URL}/api/digest/unsubscribe?token=${unsubToken}`;
  const ctaUrl = APP_URL;

  const greeting = stats.name ? `Hi ${stats.name},` : 'Hi there,';

  const statsSection = totalActions === 0
    ? `<p style="color:#9ca3af;font-size:15px;line-height:1.6;">It was a quiet week — no activity recorded. We miss you!</p>`
    : `
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:12px 16px;background:#1f2937;border-radius:8px 8px 0 0;border-bottom:1px solid #374151;">
            <span style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Classifications</span>
            <span style="float:right;color:#ffffff;font-size:20px;font-weight:700;">${stats.classifications}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#1f2937;border-bottom:1px solid #374151;">
            <span style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Analyses</span>
            <span style="float:right;color:#ffffff;font-size:20px;font-weight:700;">${stats.analyses}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px;background:#1f2937;border-radius:0 0 8px 8px;">
            <span style="color:#9ca3af;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;">Voice-Leading Calculations</span>
            <span style="float:right;color:#ffffff;font-size:20px;font-weight:700;">${stats.voiceLeadingCalculations}</span>
          </td>
        </tr>
      </table>
    `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Your Week in Musical Symmetry</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="margin-bottom:32px;">
      <p style="color:#6366f1;font-size:13px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Weekly Digest</p>
      <h1 style="color:#ffffff;font-size:26px;font-weight:700;margin:0 0 4px;">Your week in Musical Symmetry</h1>
      <p style="color:#6b7280;font-size:14px;margin:0;">${greeting} Here's what you explored this week.</p>
    </div>

    <!-- Usage Stats -->
    <div style="background:#111827;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#e5e7eb;font-size:16px;font-weight:600;margin:0 0 16px;">This Week's Activity</h2>
      ${statsSection}
    </div>

    <!-- Set Class of the Week -->
    <div style="background:#111827;border-radius:12px;padding:24px;margin-bottom:24px;border-left:3px solid #6366f1;">
      <p style="color:#6366f1;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Set Class of the Week</p>
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px;">
        <span style="color:#ffffff;font-size:22px;font-weight:700;">${setClass.forteNumber}</span>
        <span style="color:#9ca3af;font-size:15px;font-family:monospace;">${setClass.primeForm}</span>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">Interval vector: <span style="color:#d1d5db;font-family:monospace;">${setClass.intervalVector}</span></p>
      <p style="color:#e5e7eb;font-size:15px;line-height:1.6;margin:12px 0 8px;">${setClass.description}</p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;font-style:italic;">${setClass.funFact}</p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${ctaUrl}"
         style="display:inline-block;background:#6366f1;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;letter-spacing:0.01em;">
        Continue exploring &rarr;
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1f2937;padding-top:20px;text-align:center;">
      <p style="color:#4b5563;font-size:12px;margin:0 0 8px;">
        You're receiving this because you have an active Musical Symmetry account.
      </p>
      <p style="color:#4b5563;font-size:12px;margin:0;">
        <a href="${unsubUrl}" style="color:#6366f1;text-decoration:none;">Unsubscribe from weekly digests</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildDigestText(stats: UserDigestStats, setClass: SetClassOfWeek, unsubToken: string): string {
  const unsubUrl = `${APP_URL}/api/digest/unsubscribe?token=${unsubToken}`;
  const greeting = stats.name ? `Hi ${stats.name},` : 'Hi there,';

  return `Your week in Musical Symmetry
${greeting}

This Week's Activity
--------------------
Classifications:              ${stats.classifications}
Analyses:                     ${stats.analyses}
Voice-Leading Calculations:   ${stats.voiceLeadingCalculations}

Set Class of the Week: ${setClass.forteNumber} ${setClass.primeForm}
Interval vector: ${setClass.intervalVector}

${setClass.description}

${setClass.funFact}

Continue exploring: ${APP_URL}

---
To unsubscribe from weekly digests: ${unsubUrl}
`;
}

export interface SendDigestResult {
  sent: number;
  skipped: number;
  errors: number;
}

export async function sendWeeklyDigests(): Promise<SendDigestResult> {
  if (!RESEND_API_KEY) {
    console.warn('[digest] RESEND_API_KEY not set — skipping digest send');
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  // Find active non-anonymous users who haven't opted out
  const activeUsers = db.prepare(`
    SELECT DISTINCT u.id, u.email, u.name, u.tier, u.digest_optout
    FROM users u
    INNER JOIN api_usage a ON a.user_id = u.id
    WHERE u.tier != 'anonymous'
      AND u.digest_optout = 0
      AND a.timestamp >= ?
  `).all(thirtyDaysAgo) as ActiveUser[];

  const setClass = getSetClassOfTheWeek();
  const result: SendDigestResult = { sent: 0, skipped: 0, errors: 0 };

  for (const user of activeUsers) {
    try {
      const stats = getUserWeeklyStats(user.id);
      if (!stats) {
        result.skipped++;
        continue;
      }

      // Generate a simple unsubscribe token (base64 of user id)
      const unsubToken = Buffer.from(user.id).toString('base64url');
      const html = buildDigestHtml(stats, setClass, unsubToken);
      const text = buildDigestText(stats, setClass, unsubToken);

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: user.email,
          subject: 'Your week in Musical Symmetry',
          html,
          text,
        }),
      });

      if (res.ok) {
        db.prepare('UPDATE users SET last_digest_sent = datetime(\'now\') WHERE id = ?').run(user.id);
        result.sent++;
      } else {
        const body = await res.text();
        console.error(`[digest] Resend error for ${user.email} (${res.status}): ${body}`);
        result.errors++;
      }
    } catch (err) {
      console.error(`[digest] Failed to send digest to ${user.email}:`, err);
      result.errors++;
    }
  }

  // Log the send event
  try {
    db.prepare('INSERT INTO digest_log (recipients, status) VALUES (?, ?)').run(
      result.sent,
      result.errors === 0 ? 'ok' : 'partial',
    );
  } catch (err) {
    console.error('[digest] Failed to write digest_log:', err);
  }

  console.log(`[digest] Sent ${result.sent}, skipped ${result.skipped}, errors ${result.errors}`);
  return result;
}

export function buildPreviewHtml(userId: string): string | null {
  const stats = getUserWeeklyStats(userId);
  if (!stats) return null;

  const setClass = getSetClassOfTheWeek();
  const unsubToken = Buffer.from(userId).toString('base64url');
  return buildDigestHtml(stats, setClass, unsubToken);
}

export function getLastDigestSentAt(): string | null {
  const db = getDb();
  const row = db.prepare('SELECT sent_at FROM digest_log ORDER BY id DESC LIMIT 1').get() as { sent_at: string } | undefined;
  return row?.sent_at ?? null;
}
