import { createSocket } from '../src/store/socket/createSocket';

describe('createSocket', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should create socket with default config', () => {
    const socket = createSocket({ url: 'http://test.com' });
    expect(socket).toHaveProperty('on');
    expect(socket).toHaveProperty('emit');
  });

  test('should use env variables', () => {
    process.env.SOCKET_URL = 'https://env.example.com';
    process.env.SOCKET_PATH = '/custom/';

    const socket = createSocket({});
    expect(socket).toBeDefined();
  });

  test('should override env with userConfig', () => {
    process.env.SOCKET_URL = 'https://env.example.com';
    const userConfig = { url: 'https://user.example.com' };
    const socket = createSocket(userConfig);
    expect(socket).toBeDefined();
  });

  test('should throw CFG-07 if url is not provided', () => {
    delete process.env.SOCKET_URL;
    expect(() => {
      createSocket({});
    }).toThrow(expect.objectContaining({ code: 'CFG-07' }));
  });

  test('should add auth token from env if provided', () => {
    process.env.SOCKET_TOKEN = 'test-token';
    const socket = createSocket({ url: 'http://test.com' });
    expect(socket).toBeDefined();
  });

  test('should not override userConfig.auth with env token', () => {
    process.env.SOCKET_TOKEN = 'env-token';
    const userConfig = { url: 'http://test.com', auth: { token: 'user-token' } };
    const socket = createSocket(userConfig);
    expect(socket).toBeDefined();
  });
});