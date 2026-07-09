import { createSlice, createSelector } from '@reduxjs/toolkit';
import { increment, decrement, setUnsubscribe, getUnsubscribe, clearUnsubscribe } from '../registry';

/**
 * Создаёт сущность с состоянием, инициализацией и встроенной подпиской.
 *
 * @param {Object} params
 * @param {string} params.name - уникальное имя сущности (ключ в store)
 * @param {Object} params.initialState - начальное состояние данных (без служебных полей)
 * @param {Object} params.reducers - объект с редьюсерами для данных
 * @param {string} params.call - имя события Socket.IO для запроса данных
 * @param {string} params.save - имя экшена из reducers для сохранения данных
 * @param {Object} params.handlers - объект, где ключ — событие, значение — имя экшена из reducers или экшен-криэйтор
 * @param {Socket} params.socket - экземпляр сокета
 * @returns {Object} { slice, actions, init, clean, selectors }
 */
export const createEntity = ({ name, initialState, reducers, call, save, handlers, socket }) => {
  // Служебные редьюсеры
  const builtinReducers = {
    start: (state) => {
      state.loading = true;
      state.error = null;
    },
    success: (state) => {
      state.loading = false;
      state.initialized = true;
    },
    fail: (state, action) => {
      state.loading = false;
      state.error = action.payload;
    },
    reset: (state) => {
      Object.assign(state, initialState);
      state.loading = false;
      state.error = null;
      state.initialized = false;
    },
  };

  const allReducers = { ...reducers, ...builtinReducers };

  const slice = createSlice({
    name,
    initialState: { ...initialState, loading: false, error: null, initialized: false },
    reducers: allReducers,
  });

  const { actions } = slice;
  const { start, success, fail, reset } = actions;

  const saveAction = actions[save];
  if (!saveAction) {
    throw new Error(`createEntity: reducer "${save}" not found in reducers`);
  }

  // -----------------------------------------------------
  // Создаём подписку на основе handlers
  let subscription = null;
  if (handlers) {
    // Разрешаем имена экшенов
    const resolvedHandlers = {};
    for (const [event, config] of Object.entries(handlers)) {
      if (typeof config === 'function') {
        resolvedHandlers[event] = config;
      } else if (typeof config === 'string') {
        const action = actions[config];
        if (!action) {
          throw new Error(`createEntity: action "${config}" not found in reducers`);
        }
        resolvedHandlers[event] = action;
      } else if (config && typeof config === 'object' && config.save) {
        // Объект с комнатой и save
        const action = actions[config.save];
        if (!action) {
          throw new Error(`createEntity: action "${config.save}" not found in reducers`);
        }
        resolvedHandlers[event] = { ...config, save: action };
      } else {
        resolvedHandlers[event] = config;
      }
    }

    // Создаём подписку (используем внутреннюю функцию, аналогичную createSub)
    const createSubscription = (handlersMap, socket) => {
      const subscriptions = Object.entries(handlersMap).map(([event, config]) => {
        const isGlobal = typeof config === 'function';
        const save = isGlobal ? config : config.save;
        const roomTemplate = isGlobal ? null : config.room || null;
        return { event, save, roomTemplate };
      });

      return {
        subscribe: (dispatch, params = {}) => {
          const entries = subscriptions.map(({ event, save, roomTemplate }) => {
            const handler = (data) => dispatch(save(data));
            socket.on(event, handler);

            let room = null;
            if (roomTemplate) {
              room = roomTemplate.replace(/\{(\w+)\}/g, (_, key) => params[key] || '');
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

    subscription = createSubscription(resolvedHandlers, socket);
  }

  // -----------------------------------------------------
  // Init thunk (активирует подписку)
  const initThunk = (params = {}) => async (dispatch, getState) => {
    const state = getState()[name];
    if (state.initialized || state.loading) {
      increment(name);
      return;
    }

    dispatch(start());
    increment(name);

    try {
      const data = await new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket not provided'));
          return;
        }
        if (Object.keys(params).length === 0) {
          socket.emit(call, (response) => {
            if (response && response.error) reject(new Error(response.error));
            else resolve(response);
          });
        } else {
          socket.emit(call, params, (response) => {
            if (response && response.error) reject(new Error(response.error));
            else resolve(response);
          });
        }
      });

      dispatch(saveAction(data));

      // Активируем подписку, если она есть
      if (subscription) {
        const unsubscribe = subscription.subscribe(dispatch, params);
        setUnsubscribe(name, unsubscribe);
      }

      dispatch(success());
    } catch (error) {
      console.error('❌ Init error:', error);
      dispatch(fail(error.message));
    }
  };

  // -----------------------------------------------------
  // Clean thunk
  const cleanThunk = () => (dispatch, getState) => {
    const state = getState()[name];
    if (!state.initialized) return;

    const isLast = decrement(name);
    if (!isLast) return;

    const unsubscribe = getUnsubscribe(name);
    if (unsubscribe) {
      unsubscribe();
      clearUnsubscribe(name);
    }

    dispatch(reset());
  };

  // -----------------------------------------------------
  // Селекторы
  const selectSelf = (state) => state[name];
  const selectors = {
    selectData: selectSelf,
    selectState: selectSelf,
    selectLoading: createSelector([selectSelf], (data) => data.loading),
    selectError: createSelector([selectSelf], (data) => data.error),
    selectInitialized: createSelector([selectSelf], (data) => data.initialized),
  };

  return {
    slice,
    actions,
    init: initThunk,
    clean: cleanThunk,
    selectors,
  };
};