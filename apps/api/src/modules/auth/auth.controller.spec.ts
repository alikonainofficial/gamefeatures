import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// 6.3: WEB_URL may list several origins; OAuth must send the browser back to the first one.
describe('AuthController OAuth redirect', () => {
  const controllerWith = (webUrl: string | undefined) =>
    new AuthController(
      {} as AuthService,
      {} as UsersService,
      { get: (key: string) => (key === 'WEB_URL' ? webUrl : undefined) } as ConfigService,
    );

  const fakeResponse = () => {
    const res = { redirect: jest.fn(), cookie: jest.fn() };
    return res as unknown as Response & typeof res;
  };

  it('redirects a successful login to the first WEB_URL entry, token in the fragment', async () => {
    const res = fakeResponse();
    const req = {
      user: { tokens: { accessToken: 'access.jwt', refreshToken: 'refresh.jwt' } },
    } as unknown as Request;

    await controllerWith('https://demo.example, http://localhost:3000').googleAuthCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('https://demo.example/auth/callback#token=access.jwt');
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh.jwt', expect.any(Object));
  });

  it('redirects an OAuth error to the first WEB_URL entry', async () => {
    const res = fakeResponse();
    const req = { user: { error: 'account_exists' } } as unknown as Request;

    await controllerWith('https://demo.example,https://other.example').twitchAuthCallback(req, res);

    expect(res.redirect).toHaveBeenCalledWith('https://demo.example/login?error=account_exists');
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
