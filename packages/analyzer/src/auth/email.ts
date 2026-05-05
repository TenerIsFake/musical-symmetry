const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL || 'https://symmetry.tendrid.us';
const FROM_ADDRESS = process.env.EMAIL_FROM || 'Musical Symmetry <noreply@tendrid.us>';

export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const verifyUrl = `${APP_URL}/api/auth/verify?token=${token}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: email,
      subject: 'Your Musical Symmetry login link',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1a1a2e; margin-bottom: 24px;">Sign in to Musical Symmetry</h2>
          <p style="color: #444; line-height: 1.6;">Click the button below to sign in. This link expires in 15 minutes.</p>
          <a href="${verifyUrl}" style="display: inline-block; background: #6c5ce7; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 24px 0;">Sign In</a>
          <p style="color: #888; font-size: 13px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      text: `Sign in to Musical Symmetry: ${verifyUrl}\n\nThis link expires in 15 minutes. If you didn't request this, ignore this email.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`Resend API error (${res.status}): ${body}`);
  }

  return res.ok;
}
