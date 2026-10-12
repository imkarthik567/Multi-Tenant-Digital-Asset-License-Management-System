import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { env } from './env';
import { prisma } from './database';

export const configurePassport = (): void => {
  if (
    env.GOOGLE_CLIENT_ID &&
    env.GOOGLE_CLIENT_SECRET &&
    !env.GOOGLE_CLIENT_ID.startsWith('mock_')
  ) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            if (!email) {
              return done(new Error('Google profile did not provide an email address'), undefined);
            }

            // Find existing user by googleId or email
            let user = await prisma.user.findFirst({
              where: {
                OR: [{ googleId: profile.id }, { email }],
              },
              include: { role: true, tenant: true },
            });

            if (user) {
              // Update googleId if matched by email
              if (!user.googleId) {
                user = await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    googleId: profile.id,
                    avatarUrl: profile.photos?.[0]?.value || user.avatarUrl,
                  },
                  include: { role: true, tenant: true },
                });
              }

              return done(null, {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                tenantId: user.tenantId,
                roleId: user.roleId,
                role: user.role.name,
                isSuperAdmin: user.role.name === 'super_admin',
              });
            }

            // If user does not exist, return google profile info for tenant registration flow
            return done(null, false, {
              message: 'Account not found. Please register or join an organization first.',
            });
          } catch (error) {
            return done(error as Error, undefined);
          }
        }
      )
    );
  }
};
