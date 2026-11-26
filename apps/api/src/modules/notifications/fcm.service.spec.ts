import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { FcmService } from './fcm.service';

jest.mock('firebase-admin', () => {
  const messaging = {
    sendEachForMulticast: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
    send: jest.fn().mockResolvedValue('message-id'),
  };
  return {
    initializeApp: jest.fn(),
    credential: { cert: jest.fn((c) => c) },
    messaging: () => messaging,
  };
});

const mocked = admin as unknown as {
  initializeApp: jest.Mock;
  credential: { cert: jest.Mock };
  messaging: () => { sendEachForMulticast: jest.Mock; send: jest.Mock };
};

const config = (values: Record<string, string>) =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

const credentials = {
  FIREBASE_PROJECT_ID: 'demo-project',
  FIREBASE_PRIVATE_KEY: '-----BEGIN KEY-----\\nabc\\n-----END KEY-----',
  FIREBASE_CLIENT_EMAIL: 'push@demo-project.iam.gserviceaccount.com',
};

describe('FcmService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stays disabled without credentials and sends nothing', async () => {
    const fcm = new FcmService(config({}));
    fcm.onModuleInit();

    await fcm.sendToTokens(['t1'], { title: 'Hi', body: 'There' });
    await fcm.sendToTopic('news', { title: 'Hi', body: 'There' });

    expect(mocked.initializeApp).not.toHaveBeenCalled();
    expect(mocked.messaging().sendEachForMulticast).not.toHaveBeenCalled();
    expect(mocked.messaging().send).not.toHaveBeenCalled();
  });

  it('initializes with credentials, unescaping the private key newlines', () => {
    new FcmService(config(credentials)).onModuleInit();

    expect(mocked.credential.cert).toHaveBeenCalledWith(
      expect.objectContaining({ privateKey: '-----BEGIN KEY-----\nabc\n-----END KEY-----' }),
    );
    expect(mocked.initializeApp).toHaveBeenCalledTimes(1);
  });

  it('sends a multicast with a web-push link to the action URL', async () => {
    const fcm = new FcmService(config(credentials));
    fcm.onModuleInit();

    await fcm.sendToTokens(['t1', 't2'], { title: 'Hi', body: 'There', data: { actionUrl: '/requests/1' } });

    expect(mocked.messaging().sendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: ['t1', 't2'],
        notification: { title: 'Hi', body: 'There' },
        webpush: { fcmOptions: { link: '/requests/1' } },
      }),
    );
  });

  it('skips an empty token list and swallows send failures', async () => {
    const fcm = new FcmService(config(credentials));
    fcm.onModuleInit();

    await fcm.sendToTokens([], { title: 'Hi', body: 'There' });
    expect(mocked.messaging().sendEachForMulticast).not.toHaveBeenCalled();

    mocked.messaging().sendEachForMulticast.mockRejectedValueOnce(new Error('FCM down'));
    await expect(fcm.sendToTokens(['t1'], { title: 'Hi', body: 'There' })).resolves.toBeUndefined();

    mocked.messaging().send.mockRejectedValueOnce(new Error('FCM down'));
    await expect(fcm.sendToTopic('news', { title: 'Hi', body: 'There' })).resolves.toBeUndefined();
  });

  it('sends to a topic', async () => {
    const fcm = new FcmService(config(credentials));
    fcm.onModuleInit();
    await fcm.sendToTopic('news', { title: 'Hi', body: 'There' });
    expect(mocked.messaging().send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'news', notification: { title: 'Hi', body: 'There' } }),
    );
  });

  it('keeps push disabled if Firebase rejects the credentials', async () => {
    mocked.initializeApp.mockImplementationOnce(() => {
      throw new Error('bad key');
    });
    const fcm = new FcmService(config(credentials));
    fcm.onModuleInit();

    await fcm.sendToTokens(['t1'], { title: 'Hi', body: 'There' });
    expect(mocked.messaging().sendEachForMulticast).not.toHaveBeenCalled();
  });
});
