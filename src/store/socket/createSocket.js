import { io } from 'socket.io-client'

/**
 * Получить переменную окружения (поддерживает Vite, CRA, Node.js)
 */
const getEnv = (key) => {
  // Vite
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || import.meta.env[`VITE_${key}`]
  }
  // CRA / Node.js
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || process.env[`REACT_APP_${key}`]
  }
  return undefined
}

const DEFAULT_CONFIG = {
  url: 'http://localhost:3000',
  path: '/socket.io/',
  autoConnect: true,
  transports: ['websocket'],
  withCredentials: false,
}

/**
 * Создаёт экземпляр Socket.IO
 * @param {Object} userConfig - пользовательские настройки (перекрывают env)
 * @returns {Socket} экземпляр сокета
 */
export const createSocket = (userConfig = {}) => {
  const envUrl = getEnv('SOCKET_URL')
  const envPath = getEnv('SOCKET_PATH')
  const envToken = getEnv('SOCKET_TOKEN')

  const config = {
    ...DEFAULT_CONFIG,
    ...(envUrl && { url: envUrl }),
    ...(envPath && { path: envPath }),
    ...userConfig,
  }

  if (envToken && !userConfig.auth) {
    config.auth = { token: envToken }
  }

  return io(config.url, config)
}

// Экспортируем синглтон (опционально)
let socketInstance = null

export const getSocket = (userConfig = {}) => {
  if (!socketInstance) {
    socketInstance = createSocket(userConfig)
  }
  return socketInstance
}