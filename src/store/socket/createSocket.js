import { io } from 'socket.io-client';
import { createError } from '../../errors';

/**
 * Получает переменную окружения.
 * @param {string} key
 * @returns {string|undefined}
 */
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

/**
 * Создаёт экземпляр Socket.IO с конфигурацией из переменных окружения.
 * @param {Object} userConfig – пользовательские настройки (перекрывают env)
 * @returns {Socket}
 */
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

/**
 * Возвращает глобальный экземпляр сокета (создаёт, если его нет).
 * @param {Object} userConfig
 * @returns {Socket}
 */
export const getSocket = (userConfig = {}) => {
  if (!socketInstance) {
    socketInstance = createSocket(userConfig);
  }
  return socketInstance;
};