import { io } from 'socket.io-client';
import { createError } from '../../errors';

const getEnv = (key) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`REACT_APP_${key}`];
  }
  return undefined;
};

const DEFAULT_CONFIG = {
  path: '/socket.io/',
  autoConnect: true,
  transports: ['websocket'],
  withCredentials: false,
};

export const createSocket = (userConfig = {}) => {
  const envUrl = getEnv('SOCKET_URL');
  const envPath = getEnv('SOCKET_PATH');
  const envToken = getEnv('SOCKET_TOKEN');

  const config = {
    ...DEFAULT_CONFIG,
    ...(envUrl && { url: envUrl }),
    ...(envPath && { path: envPath }),
    ...userConfig,
  };

  if (!config.url) {
    throw createError('CFG-07', 'socket url is not provided', {
      factory: 'createSocket',
    });
  }

  if (envToken && !userConfig.auth) {
    config.auth = { token: envToken };
  }

  return io(config.url, config);
};

let socketInstance = null;

export const getSocket = (userConfig = {}) => {
  if (!socketInstance) {
    socketInstance = createSocket(userConfig);
  }
  return socketInstance;
};