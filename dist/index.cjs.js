'use strict';

var socket_ioClient = require('socket.io-client');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
/**
 * Создаёт подписку на события сервера.
 * @param {Object} handlers - { 'eventName': actionCreator }
 * @param {Socket} socket - экземпляр сокета (опционально, если не передан, использует глобальный)
 * @returns {Function} subscribe(dispatch) => unsubscribe
 */
const createSub = (handlers, socket) => {
  return dispatch => {
    const entries = Object.entries(handlers);
    const boundHandlers = entries.map(([event, actionCreator]) => {
      const handler = data => dispatch(actionCreator(data));
      if (socket) {
        socket.on(event, handler);
      } else {
        // если сокет не передан, предполагаем, что он уже создан где-то глобально
        // но лучше явно передавать
        console.warn('createSub: socket not provided, event not bound');
      }
      return {
        event,
        handler
      };
    });

    // Возвращаем функцию отписки
    return () => {
      boundHandlers.forEach(({
        event,
        handler
      }) => {
        if (socket) {
          socket.off(event, handler);
        }
      });
    };
  };
};

/**
 * Внутренний реестр для хранения:
 * - counters: { [sliceName]: number } – количество активных подписчиков
 * - unsubscribes: { [sliceName]: function } – функции отписки
 */
const registry = {
  counters: {},
  unsubscribes: {}
};
const increment = sliceName => {
  registry.counters[sliceName] = (registry.counters[sliceName] || 0) + 1;
};
const decrement = sliceName => {
  registry.counters[sliceName] = (registry.counters[sliceName] || 1) - 1;
  return registry.counters[sliceName] === 0; // true, если был последним
};
const setUnsubscribe = (sliceName, unsubscribeFn) => {
  registry.unsubscribes[sliceName] = unsubscribeFn;
};
const getUnsubscribe = sliceName => {
  return registry.unsubscribes[sliceName];
};
const clearUnsubscribe = sliceName => {
  delete registry.unsubscribes[sliceName];
};

// Для отладки (не обязательно)
const getRegistry = () => registry;

/**
 * Получить переменную окружения (поддерживает Vite, CRA, Node.js)
 */
const getEnv = key => {
  // Vite
  if (typeof ({ url: (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.src || new URL('index.cjs.js', document.baseURI).href)) }) !== 'undefined' && undefined) {
    return undefined[key] || undefined[`VITE_${key}`];
  }
  // CRA / Node.js
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`REACT_APP_${key}`];
  }
  return undefined;
};
const DEFAULT_CONFIG = {
  url: 'http://localhost:3000',
  path: '/socket.io/',
  autoConnect: true,
  transports: ['websocket'],
  withCredentials: false
};

/**
 * Создаёт экземпляр Socket.IO
 * @param {Object} userConfig - пользовательские настройки (перекрывают env)
 * @returns {Socket} экземпляр сокета
 */
const createSocket = (userConfig = {}) => {
  const envUrl = getEnv('SOCKET_URL');
  const envPath = getEnv('SOCKET_PATH');
  const envToken = getEnv('SOCKET_TOKEN');
  const config = {
    ...DEFAULT_CONFIG,
    ...(envUrl && {
      url: envUrl
    }),
    ...(envPath && {
      path: envPath
    }),
    ...userConfig
  };
  if (envToken && !userConfig.auth) {
    config.auth = {
      token: envToken
    };
  }
  return socket_ioClient.io(config.url, config);
};

// Экспортируем синглтон (опционально)
let socketInstance = null;
const getSocket = (userConfig = {}) => {
  if (!socketInstance) {
    socketInstance = createSocket(userConfig);
  }
  return socketInstance;
};

exports.clearUnsubscribe = clearUnsubscribe;
exports.createSocket = createSocket;
exports.createSub = createSub;
exports.decrement = decrement;
exports.getRegistry = getRegistry;
exports.getSocket = getSocket;
exports.getUnsubscribe = getUnsubscribe;
exports.increment = increment;
exports.setUnsubscribe = setUnsubscribe;
