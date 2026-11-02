import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env, features } from '../config/env';
import { prisma } from '../lib/prisma';
import { AUTH_COOKIE, requireAuth, setSessionCookie } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';

export const authRouter = Router();

const googleRedirectUri = () => `${env.BACKEND_URL}/api/auth/google/callback`;
const googleClient = () =>
  new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, googleRedirectUri());

const publicUser = (u: { id: string; email: string; name: string; avatarUrl: string | null }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl,
});

/** Which optional integrations are configured – lets the UI show helpful messages. */
authRouter.get('/config', (_req, res) => {
  res.json({
    googleEnabled: features.google,
    slackEnabled: features.slack,
    simulatedDelivery: features.simulatedDelivery,
  });
});

// ---------- Google OAuth (authorization code flow) ----------
authRouter.get('/google', (_req, res) => {
  if (!features.google) return res.redirect(`${env.FRONTEND_URL}/login?error=google_not_configured`);
  const state = jwt.sign({ purpose: 'google' }, env.JWT_SECRET, { expiresIn: '10m' });
  const url = googleClient().generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string };
    try {
      if (!code || !state) throw new Error('missing code');
      const payload = jwt.verify(state, env.JWT_SECRET) as { purpose: string };
      if (payload.purpose !== 'google') throw new Error('bad state');

      const client = googleClient();
      const { tokens } = await client.getToken(code);
      const ticket = await client.verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID });
      const profile = ticket.getPayload();
      if (!profile?.email || !profile.sub) throw new Error('no profile');

      const user = await prisma.user.upsert({
        where: { email: profile.email.toLowerCase() },
        update: { googleId: profile.sub, name: profile.name ?? profile.email, avatarUrl: profile.picture ?? null },
        create: {
          email: profile.email.toLowerCase(),
          googleId: profile.sub,
          name: profile.name ?? profile.email,
          avatarUrl: profile.picture ?? null,
        },
      });
      setSessionCookie(res, user.id);
      res.redirect(`${env.FRONTEND_URL}/scheduled`);
    } catch {
      res.redirect(`${env.FRONTEND_URL}/login?error=google_failed`);
    }
  }),
);

// ---------- Email + password ("or sign up through email") ----------
const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

/** Logs in an existing user, or signs up a new one if the email is not registered yet. */
authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const normalized = email.toLowerCase();
    let user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user) {
      const local = normalized.split('@')[0];
      const name = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join(' ');
      user = await prisma.user.create({
        data: { email: normalized, name: name || normalized, passwordHash: await bcrypt.hash(password, 10) },
      });
    } else if (!user.passwordHash) {
      throw new HttpError(401, 'This account uses Google login');
    } else if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new HttpError(401, 'Incorrect email or password');
    }

    setSessionCookie(res, user.id);
    res.json({ user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new HttpError(401, 'Not authenticated');
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.json({ ok: true });
});
