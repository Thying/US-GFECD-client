import { createSlice, createSelector } from '@reduxjs/toolkit';
import { increment, decrement, setUnsubscribe, getUnsubscribe, clearUnsubscribe } from '../registry';

/**
 * Создаёт сущность с состоянием, инициализацией и подписками.
 *
 * @param {Object} params
 * @param {string} params.name - уникальное имя сущности (будет ключом в store)
 * @param {Object} params.initialState - начальное состояние данных (без служебных полей)
 * @param {Object} params.reducers - объект с редьюсерами для данных
 * @param {string} params.save - имя экшена из reducers, который будет использоваться для сохранения данных (например, 'setData')
 * @param {string} params.call - имя события Socket.IO для запроса данных
 * @param {Object} params.sub - подписка (результат createSub)
 * @param {Socket} params.socket - экземпляр сокета
 * @returns {Object} { slice, actions, init, clean, selectors }
 */
export const createEntity = ({ name, initialState, reducers, save, call, sub, socket }) => {
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

  // Получаем экшен-криэйтор для сохранения по имени
  const saveAction = actions[save];
  if (!saveAction) {
    throw new Error(`createEntity: reducer "${save}" not found in reducers`);
  }

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
      // Если параметры пустые, не передаём их в emit (как в createInit)
      const data = await new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket not provided'));
          return;
        }
        if (Object.keys(params).length === 0) {
          socket.emit(call, (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        } else {
          socket.emit(call, params, (response) => {
            if (response && response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          });
        }
      });

      // Сохраняем данные через экшен-криэйтор saveAction
      dispatch(saveAction(data));

      // Подписываемся на события
      const unsubscribe = sub.subscribe(dispatch, params);
      setUnsubscribe(name, unsubscribe);

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

    // Сбрасываем всё состояние (данные + флаги)
    dispatch(reset());
  };

  // -----------------------------------------------------
  // Селекторы
  const selectSelf = (state) => state[name];

  const selectors = {
    selectData: selectSelf,
    selectState: selectSelf,
    selectLoading: createSelector(
      [selectSelf],
      (data) => data.loading
    ),
    selectError: createSelector(
      [selectSelf],
      (data) => data.error
    ),
    selectInitialized: createSelector(
      [selectSelf],
      (data) => data.initialized
    ),
  };

  return {
    slice,
    actions,
    init: initThunk,
    clean: cleanThunk,
    selectors,
  };
};