import { createSlice } from '@reduxjs/toolkit';
import { increment, decrement, setUnsubscribe, getUnsubscribe, clearUnsubscribe } from '../registry';

/**
 * Создаёт сущность с состоянием, инициализацией и подписками.
 * 
 * @param {Object} params
 * @param {string} params.name - уникальное имя сущности (будет ключом в store)
 * @param {Object} params.initialState - начальное состояние данных (без служебных полей)
 * @param {Object} params.reducers - объект с редьюсерами для данных
 * @param {string} params.call - имя события Socket.IO для запроса данных
 * @param {Object} params.sub - подписка (результат createSub)
 * @param {Function} params.save - экшен для сохранения данных (из reducers)
 * @param {Socket} params.socket - экземпляр сокета
 * @returns {Object} { slice, actions, init, clean, selectors }
 */
export const createEntity = ({ name, initialState, reducers, call, sub, save, socket }) => {
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
      // Сбрасываем данные в начальное состояние
      Object.assign(state, initialState);
      state.loading = false;
      state.error = null;
      state.initialized = false;
    },
  };

  // Объединяем пользовательские редьюсеры со служебными
  const allReducers = {
    ...reducers,
    ...builtinReducers,
  };

  // Создаём slice
  const slice = createSlice({
    name,
    initialState: {
      ...initialState,
      loading: false,
      error: null,
      initialized: false,
    },
    reducers: allReducers,
  });

  const { actions } = slice;

  // Отделяем служебные экшены (для использования внутри)
  const { start, success, fail, reset } = actions;

  // -----------------------------------------------------
  // Init thunk
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
        socket.emit(call, params, (response) => {
          if (response && response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        });
      });

      // Сохраняем данные через пользовательский экшен save
      dispatch(save(data));

      // Подписываемся на события
      const unsubscribe = sub.subscribe(dispatch, params);
      setUnsubscribe(name, unsubscribe);

      dispatch(success());
    } catch (error) {
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

    // Сбрасываем всё состояние (данные + флаги)
    dispatch(reset());
  };

  // -----------------------------------------------------
  // Selectors
  const selectors = {
    selectData: (state) => state[name],
    selectState: (state) => state[name],
    selectLoading: (state) => state[name].loading,
    selectInitialized: (state) => state[name].initialized,
    selectError: (state) => state[name].error,
  };

  return {
    slice,
    actions,
    init: initThunk,
    clean: cleanThunk,
    selectors,
  };
};