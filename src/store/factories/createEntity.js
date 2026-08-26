import { createSlice, createSelector } from '@reduxjs/toolkit';
import { increment, decrement, setUnsubscribe, getUnsubscribe, clearUnsubscribe } from '../registry';
import { createError, logWarning } from '../../errors';

const DEFAULT_ID_KEY = '__default__';

const serializeId = (id) => {
  if (id === undefined || id === null || (typeof id === 'object' && Object.keys(id).length === 0)) {
    return DEFAULT_ID_KEY;
  }
  return JSON.stringify(id);
};

/**
 * @template T
 * @typedef {Object} EntityConfig
 * @property {string} name – уникальное имя сущности (используется как ключ в store)
 * @property {T} reducers – объект редьюсеров (каждый редьюсер получает локальное состояние без полей loading/error/initialized)
 * @property {any} initialState – начальное состояние для данных (без loading/error/initialized)
 * @property {string} call – имя события Socket.IO для запроса данных
 * @property {keyof T} save – имя экшена, в который сохранять полученные данные
 * @property {Object<string, keyof T | { save: keyof T, room?: string }>} handlers – маппинг событий сервера на экшены
 * @property {any} socket – экземпляр Socket.IO
 * @property {Function} [onSend] – глобальный хук перед отправкой запроса
 * @property {Function} [onSave] – глобальный хук после получения данных
 * @property {Function} [onDone] – глобальный хук после успешного завершения
 * @property {Function} [onError] – глобальный хук при ошибке
 * @property {Function} [onClean] – глобальный хук перед очисткой
 * @property {Function} [onEnd] – глобальный хук после очистки
 */

export const createEntity = ({
  name,
  initialState,
  reducers,
  call,
  save,
  handlers,
  socket,
  onSend: globalOnSend,
  onSave: globalOnSave,
  onDone: globalOnDone,
  onError: globalOnError,
  onClean: globalOnClean,
  onEnd: globalOnEnd,
}) => {
  if (!name) {
    throw createError('CFG-05', 'name is required', { factory: 'createEntity' });
  }
  if (!call) {
    throw createError('CFG-05', 'call is required', {
      factory: 'createEntity',
      entity: name,
    });
  }

  const getDefaultState = () => ({
    ...initialState,
    loading: false,
    error: null,
    initialized: false,
  });

  const adaptedReducers = {};
  Object.entries(reducers).forEach(([actionName, reducer]) => {
    adaptedReducers[actionName] = (state, action) => {
      const id = action.meta?.id || DEFAULT_ID_KEY;
      const idKey = serializeId(id);
      if (!state[idKey]) {
        state[idKey] = getDefaultState();
      }
      const localState = state[idKey];
      const dataState = { ...localState };
      delete dataState.loading;
      delete dataState.error;
      delete dataState.initialized;
      // Вызываем редьюсер на копии данных
      reducer(dataState, action);
      // Копируем обновлённые данные обратно в localState
      Object.assign(localState, dataState);
    };
  });

  const builtinReducers = {
    start: (state, action) => {
      const id = action.payload?.id || DEFAULT_ID_KEY;
      const idKey = serializeId(id);
      if (!state[idKey]) {
        state[idKey] = getDefaultState();
      }
      state[idKey].loading = true;
      state[idKey].error = null;
    },
    success: (state, action) => {
      const id = action.payload?.id || DEFAULT_ID_KEY;
      const idKey = serializeId(id);
      if (!state[idKey]) {
        state[idKey] = getDefaultState();
      }
      state[idKey].loading = false;
      state[idKey].initialized = true;
    },
    fail: (state, action) => {
      const id = action.payload?.id || DEFAULT_ID_KEY;
      const idKey = serializeId(id);
      if (!state[idKey]) {
        state[idKey] = getDefaultState();
      }
      state[idKey].loading = false;
      state[idKey].error = action.payload.error || 'Unknown error';
    },
    reset: (state, action) => {
      const id = action.payload?.id || DEFAULT_ID_KEY;
      const idKey = serializeId(id);
      if (state[idKey]) {
        delete state[idKey];
      }
    },
  };

  const allReducers = { ...adaptedReducers, ...builtinReducers };

  const slice = createSlice({
    name,
    initialState: {},
    reducers: allReducers,
  });

  const { actions } = slice;
  const { start, success, fail, reset } = actions;

  const saveAction = actions[save];
  if (!saveAction) {
    const available = Object.keys(actions);
    throw createError('CFG-01', `save action "${save}" not found in reducers`, {
      factory: 'createEntity',
      entityName: name,
      availableActions: available,
    });
  }

  let subscription = null;
  let requiredParams = [];

  if (handlers) {
    if (typeof handlers !== 'object') {
      throw createError('CFG-03', 'handlers must be an object', {
        factory: 'createEntity',
        entityName: name,
      });
    }

    const resolvedHandlers = {};

    for (const [event, config] of Object.entries(handlers)) {
      if (typeof config === 'function') {
        resolvedHandlers[event] = config;
      } else if (typeof config === 'string') {
        const action = actions[config];
        if (!action) {
          const available = Object.keys(actions);
          throw createError('CFG-06', `handler for event "${event}" references action "${config}" not found in reducers`, {
            factory: 'createEntity',
            entityName: name,
            event,
            missingAction: config,
            availableActions: available,
          });
        }
        resolvedHandlers[event] = action;
      } else if (config && typeof config === 'object') {
        if (!config.save) {
          throw createError('CFG-04', `handler for event "${event}" is missing "save" property`, {
            factory: 'createEntity',
            entityName: name,
            event,
          });
        }
        const action = actions[config.save];
        if (!action) {
          const available = Object.keys(actions);
          throw createError('CFG-06', `handler for event "${event}" references action "${config.save}" not found in reducers`, {
            factory: 'createEntity',
            entityName: name,
            event,
            missingAction: config.save,
            availableActions: available,
          });
        }
        if (config.room) {
          const matches = config.room.match(/\{(\??)(\w+)\}/g) || [];
          matches.forEach((match) => {
            const parts = match.match(/\{(\??)(\w+)\}/);
            if (parts) {
              const optional = parts[1] === '?';
              const param = parts[2];
              if (!optional && !requiredParams.includes(param)) {
                requiredParams.push(param);
              }
            }
          });
        }
        resolvedHandlers[event] = { ...config, save: action };
      } else {
        throw createError('CFG-03', 'invalid handler format', {
          factory: 'createEntity',
          entityName: name,
          event,
          handler: config,
        });
      }
    }

    if (!socket) {
      throw createError('CFG-02', 'socket not provided for subscription', {
        factory: 'createEntity',
        entityName: name,
      });
    }

    const createSubscription = (handlersMap) => {
      const subscriptions = Object.entries(handlersMap).map(([event, config]) => {
        const isGlobal = typeof config === 'function';
        const save = isGlobal ? config : config.save;
        const roomTemplate = isGlobal ? null : config.room || null;
        return { event, save, roomTemplate };
      });

      return {
        subscribe: (dispatch, idParams = {}) => {
          requiredParams.forEach((param) => {
            if (!(param in idParams)) {
              throw createError('CFG-08', `required parameter "${param}" is missing for room template`, {
                factory: 'createEntity',
                entityName: name,
                param,
              });
            }
          });

          const entries = subscriptions.map(({ event, save, roomTemplate }) => {
            const handler = (data) => {
              const action = save(data);
              if (action.meta && typeof action.meta === 'object') {
                action.meta.id = idParams;
              } else {
                action.meta = { id: idParams };
              }
              dispatch(action);
            };
            socket.on(event, handler);

            let room = null;
            if (roomTemplate) {
              room = roomTemplate.replace(/\{(\??)(\w+)\}/g, (_, optional, key) => {
                if (optional === '?') {
                  return idParams[key] !== undefined ? idParams[key] : '';
                }
                return idParams[key] !== undefined ? idParams[key] : '';
              });
              if (room) {
                socket.emit('join', room);
              }
            }

            return { event, handler, room };
          });

          return () => {
            entries.forEach(({ event, handler, room }) => {
              socket.off(event, handler);
              if (room) {
                socket.emit('leave', room);
              }
            });
          };
        },
      };
    };

    subscription = createSubscription(resolvedHandlers);
  }

  const entityInstance = (idParams = {}) => {
    const idKey = serializeId(idParams);

    if (subscription) {
      requiredParams.forEach((param) => {
        if (!(param in idParams)) {
          throw createError('CFG-08', `required parameter "${param}" is missing for room template`, {
            factory: 'createEntity',
            entityName: name,
            param,
          });
        }
      });
    }

    const selectSelf = (state) => {
      const sliceState = state[name];
      if (!sliceState) return getDefaultState();
      return sliceState[idKey] || getDefaultState();
    };

    const selectData = createSelector(
      [selectSelf],
      (s) => {
        const { loading, error, initialized, ...data } = s;
        return data;
      }
    );

    const selectors = {
      selectData,
      selectState: selectSelf,
      selectLoading: createSelector([selectSelf], (s) => s.loading),
      selectError: createSelector([selectSelf], (s) => s.error),
      selectInitialized: createSelector([selectSelf], (s) => s.initialized),
    };

    const initThunk = () => async (dispatch, getState) => {
      const state = getState()[name];
      const current = state?.[idKey] || getDefaultState();
      if (current.initialized || current.loading) {
        increment(name, idParams);
        logWarning('LIF-02', 'init called while already initialized', {
          factory: 'createEntity',
          entityName: name,
          id: idParams,
        });
        return;
      }

      dispatch(start({ id: idParams }));
      increment(name, idParams);

      const callHook = async (hookName, defaultValue, globalHook, ...args) => {
        if (globalHook) {
          return await globalHook(...args, { dispatch, getState });
        }
        return typeof defaultValue === 'function' ? defaultValue(...args) : defaultValue;
      };

      try {
        const sendResult = await callHook('onSend', idParams, globalOnSend, idParams);
        if (sendResult === null) {
          logWarning('HOK-02', 'request cancelled by onSend returning null', {
            factory: 'createEntity',
            entityName: name,
            id: idParams,
          });
          return null;
        }
        const finalParams = sendResult;

        const data = await new Promise((resolve, reject) => {
          if (!socket) {
            reject(createError('CFG-02', 'socket not provided', {
              factory: 'createEntity',
              entityName: name,
              id: idParams,
            }));
            return;
          }
          const hasData = finalParams && typeof finalParams === 'object' && Object.keys(finalParams).length > 0;
          if (!hasData) {
            socket.emit(call, (response) => {
              if (response && response.error) {
                reject(createError('NET-03', 'server returned error', {
                  factory: 'createEntity',
                  entityName: name,
                  serverError: response.error,
                  id: idParams,
                }));
              } else {
                resolve(response);
              }
            });
          } else {
            socket.emit(call, finalParams, (response) => {
              if (response && response.error) {
                reject(createError('NET-03', 'server returned error', {
                  factory: 'createEntity',
                  entityName: name,
                  serverError: response.error,
                  id: idParams,
                }));
              } else {
                resolve(response);
              }
            });
          }
        });

        const saveResult = await callHook('onSave', data, globalOnSave, data);
        let savedData = saveResult;
        if (savedData !== null) {
          const action = saveAction(savedData);
          if (action.meta && typeof action.meta === 'object') {
            action.meta.id = idParams;
          } else {
            action.meta = { id: idParams };
          }
          dispatch(action);
        } else {
          logWarning('DAT-07', 'onSave returned null, saving skipped', {
            factory: 'createEntity',
            entityName: name,
            id: idParams,
          });
        }

        await callHook('onDone', () => {}, globalOnDone, savedData);

        if (subscription) {
          const unsubscribe = subscription.subscribe(dispatch, idParams);
          setUnsubscribe(name, idParams, unsubscribe);
        }

        dispatch(success({ id: idParams }));
        return savedData;
      } catch (error) {
        if (error.code) {
          await callHook('onError', () => {}, globalOnError, error);
          throw error;
        }
        const processedError = createError('DAT-03', 'unexpected error in entity init', {
          factory: 'createEntity',
          entityName: name,
          originalError: error.message || error,
          id: idParams,
        });
        await callHook('onError', () => {}, globalOnError, processedError);
        dispatch(fail({ id: idParams, error: processedError.message }));
        throw processedError;
      }
    };

    const cleanThunk = () => async (dispatch, getState) => {
      const state = getState()[name];
      const current = state?.[idKey];
      if (!current || !current.initialized) {
        logWarning('LIF-01', 'clean called before init', {
          factory: 'createEntity',
          entityName: name,
          id: idParams,
        });
        return;
      }

      const isLast = decrement(name, idParams);
      if (!isLast) return;

      if (globalOnClean) {
        await globalOnClean({ dispatch, getState });
      }

      const unsubscribe = getUnsubscribe(name, idParams);
      if (unsubscribe) {
        unsubscribe();
        clearUnsubscribe(name, idParams);
      } else {
        logWarning('LIF-03', 'clean called but no active subscription', {
          factory: 'createEntity',
          entityName: name,
          id: idParams,
        });
      }

      dispatch(reset({ id: idParams }));

      if (globalOnEnd) {
        await globalOnEnd({ dispatch, getState });
      }
    };

    return {
      init: initThunk,
      clean: cleanThunk,
      selectors,
    };
  };

  entityInstance.slice = slice;
  entityInstance.actions = actions;

  return entityInstance;
};