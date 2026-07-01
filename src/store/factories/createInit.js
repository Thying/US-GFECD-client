import { createSlice } from '@reduxjs/toolkit'
import { clearUnsubscribe, decrement, getUnsubscribe, increment, setUnsubscribe } from '../registry'

let counter = 0

/**
 * Создаёт thunk для инициализации с поддержкой комнат.
 *
 * @param {Object} params
 * @param {string} params.call - имя события для запроса данных
 * @param {Function} params.save - экшен для сохранения данных
 * @param {Object} params.sub - подписка (возврат createSub)
 * @param {Socket} params.socket - экземпляр сокета
 * @returns {Object} { init, clean, selectors, sliceName }
 */
export const createInit = ({ call, save, sub, socket }) => {
  const sliceName = `init_${++counter}`

  const slice = createSlice({
    name: sliceName,
    initialState: { initialized: false, loading: false, error: null },
    reducers: {
      start: (state) => { state.loading = true; state.error = null },
      success: (state) => { state.loading = false; state.initialized = true },
      fail: (state, action) => { state.loading = false; state.error = action.payload },
      reset: (state) => { state.initialized = false; state.loading = false; state.error = null },
    },
  })

  const { start, success, fail, reset } = slice.actions

  // -----------------------------------------------------
  // Init thunk (теперь принимает параметры)
  const initThunk = (initParams = {}) => async (dispatch, getState) => {
    const state = getState()[sliceName]
    if (state.initialized || state.loading) {
      increment(sliceName)
      return
    }

    dispatch(start())
    increment(sliceName)

    try {
      // 1. Запрос данных — передаём параметры
      const data = await new Promise((resolve, reject) => {
        if (!socket) {
          reject(new Error('Socket not provided'))
          return
        }
        socket.emit(call, initParams, (response) => {
          if (response && response.error) {
            reject(new Error(response.error))
          } else {
            resolve(response)
          }
        })
      })

      // 2. Сохранение данных
      dispatch(save(data))

      // 3. Подписка на события с параметрами (для комнат)
      const unsubscribe = sub.subscribe(dispatch, initParams)
      setUnsubscribe(sliceName, unsubscribe)

      dispatch(success())
    } catch (error) {
      dispatch(fail(error.message))
    }
  }

  // -----------------------------------------------------
  // Clean thunk
  const cleanThunk = () => (dispatch, getState) => {
    const state = getState()[sliceName]
    if (!state.initialized) return

    const isLast = decrement(sliceName)
    if (!isLast) return

    const unsubscribe = getUnsubscribe(sliceName)
    if (unsubscribe) {
      unsubscribe() // здесь будет выход из комнаты
      clearUnsubscribe(sliceName)
    }

    dispatch(save([])) // очищаем данные
    dispatch(reset())
  }

  // -----------------------------------------------------
  // Selectors
  const selectors = {
    selectState: (state) => state[sliceName],
    selectLoading: (state) => state[sliceName].loading,
    selectInitialized: (state) => state[sliceName].initialized,
    selectError: (state) => state[sliceName].error,
  }

  return {
    init: initThunk,
    clean: cleanThunk,
    selectors,
    sliceName,
    slice,
  }
}