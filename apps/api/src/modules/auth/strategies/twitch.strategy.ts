import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class TwitchStrategy extends PassportStrategy(Strategy, 'twitch') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
      tokenURL: 'https://id.twitch.tv/oauth2/token',
      clientID: configService.get('TWITCH_CLIENT_ID') || 'dummy',
      clientSecret: configService.get('TWITCH_CLIENT_SECRET') || 'dummy',
      callbackURL: `${configService.get('API_URL') || 'http://localhost:3001'}/api/v1/auth/oauth/twitch/callback`,
      scope: 'user:read:email',
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: any) {
    // Fetch user info from Twitch API
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': this.configService.get('TWITCH_CLIENT_ID') || '',
      },
    });

    const data = await response.json();
    const twitchUser = data.data?.[0];

    if (!twitchUser) {
      return done(new Error('Failed to fetch Twitch user'), null);
    }

    const tokens = await this.authService.validateOAuthUser({
      email: twitchUser.email,
      username: twitchUser.display_name || twitchUser.login,
      avatarUrl: twitchUser.profile_image_url,
      twitchId: twitchUser.id,
    });

    done(null, tokens);
  }
}
