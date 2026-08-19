import { createError, logWarning } from '../../errors';

/**
 * @typedef {Object} InvokeConfig
 * @property {string} call – имя события Socket.IO
 * @property {Function} save – экшен-креатор для сохранения результата
 * @property {any} [socket] – экземпляр Socket.IO (опционально, если не задан, будет использован глобальный)
 * @property {Function} [onSend] – хук перед отправкой
 * @property {Function} [onSave] – хук после получения данных
 * @property {Function} [onDone] – хук после успешного завершения
 * @property {Function} [onError] – хук при ошибке
 */

/**
 * Создаёт thunk для выполнения запроса (метод).
 * @param {InvokeConfig} config
 * @returns {Function} – thunk (data, on?, id?) => async (dispatch, getState) => ...
 */
export const createInvoke = ({
  call,
  save,
  socket: configSocket,
  onSend: globalOnSend,
  onSave: globalOnSave,
  onDone: globalOnDone,
  onError: globalOnError,
}) => {
  if (!call) {
    throw createError('CFG-05', 'call is required', { factory: 'createInvoke' });
  }
  if (!save || typeof save !== 'function') {
    throw createError('CFG-01', 'save must be a valid action creator', {
      factory: 'createInvoke',
      call,
    });
  }

  /**
   * @param {any} data – данные для отправки
   * @param {Object} [on] – локальные хуки (onSend, onSave, onDone, onError)
   * @param {Object} [id] – параметры идентификации (для meta.id)
   * @returns {Function} – async thunk
   */
  return (data, on, id) => async (dispatch, getState) => {
    const socket = configSocket || (typeof window !== 'undefined' && window.__socket);
    if (!socket) {
      throw createError('CFG-02', 'socket not provided', {
        factory: 'createInvoke',
        call,
      });
    }

    const helpers = { dispatch, getState };
    const idParams = id || {};

    const callHook = async (hookName, defaultValue, localHook, globalHook, ...args) => {
      if (localHook) {
        const base = async (...baseArgs) => {
          if (globalHook) {
            return await globalHook(...baseArgs, helpers);
          }
          throw createError('HOK-01', `local hook called base but global hook "${hookName}" is not defined`, {
            factory: 'createInvoke',
            call,
            hook: hookName,
            id: idParams,
          });
        };
        return await localHook(...args, base, helpers);
      }
      if (globalHook) {
        return await globalHook(...args, helpers);
      }
      return typeof defaultValue === 'function' ? defaultValue(...args) : defaultValue;
    };

    try {
      const sendResult = await callHook('onSend', data, on?.onSend, globalOnSend, data);
      if (sendResult === null) {
        logWarning('HOK-02', 'request cancelled by onSend returning null', {
          factory: 'createInvoke',
          call,
          id: idParams,
        });
        return null;
      }
      const finalData = sendResult;

      const hasData = finalData && typeof finalData === 'object' && Object.keys(finalData).length > 0;
      const response = await new Promise((resolve, reject) => {
        if (!hasData) {
          socket.emit(call, (res) => {
            if (res && res.error) {
              reject(createError('NET-03', 'server returned error', {
                factory: 'createInvoke',
                call,
                serverError: res.error,
                id: idParams,
              }));
            } else {
              resolve(res);
            }
          });
        } else {
          socket.emit(call, finalData, (res) => {
            if (res && res.error) {
              reject(createError('NET-03', 'server returned error', {
                factory: 'createInvoke',
                call,
                serverError: res.error,
                id: idParams,
              }));
            } else {
              resolve(res);
            }
          });
        }
      });

      const saveResult = await callHook('onSave', response, on?.onSave, globalOnSave, response);
      let savedData = saveResult;
      if (savedData !== null) {
        const action = save(savedData);
        if (action.meta && typeof action.meta === 'object') {
          action.meta.id = idParams;
        } else {
          action.meta = { id: idParams };
        }
        dispatch(action);
      } else {
        logWarning('DAT-07', 'onSave returned null, saving skipped', {
          factory: 'createInvoke',
          call,
          id: idParams,
        });
      }

      await callHook('onDone', () => {}, on?.onDone, globalOnDone, savedData);
      return savedData;
    } catch (error) {
      if (error.code) {
        if (globalOnError || on?.onError) {
          await callHook('onError', () => {}, on?.onError, globalOnError, error);
        }
        throw error;
      }
      const processedError = createError('DAT-03', 'unexpected error in invoke', {
        factory: 'createInvoke',
        call,
        originalError: error.message || error,
        id: idParams,
      });
      if (globalOnError || on?.onError) {
        await callHook('onError', () => {}, on?.onError, globalOnError, processedError);
      }
      throw processedError;
    }
  };
};