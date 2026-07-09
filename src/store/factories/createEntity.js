import { createSlice, createSelector } from '@reduxjs/toolkit';
import { increment, decrement, setUnsubscribe, getUnsubscribe, clearUnsubscribe } from '../registry';

export const createEntity = ({ name, initialState, reducers, call, save, socket }) => {
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
      dispatch(success());
    } catch (error) {
      console.error('❌ Init error:', error);
      dispatch(fail(error.message));
    }
  };

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