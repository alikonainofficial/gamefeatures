import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID') || 'dummy',
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET') || 'dummy',
      callbackURL: `${configService.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/oauth/google/callback`,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const { id, emails, displayName, photos } = profile;
    const email = emails?.[0];

    // The result (tokens or a login error) becomes req.user for the callback route.
    const result = await this.authService.validateOAuthUser({
      provider: 'google',
      providerId: id,
      email: email?.value,
      // passport-google-oauth20 maps Google's `email_verified` here (boolean or 'true').
      emailVerified: email?.verified === true || email?.verified === 'true',
      username: displayName,
      avatarUrl: photos?.[0]?.value,
    });

    done(null, result);
  }
}
