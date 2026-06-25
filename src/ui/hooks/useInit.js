import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

/**
 * Хук для управления инициализацией и очисткой.
 * @param {Function} init - функция инициализации (обычно thunk)
 * @param {Function} clean - функция очистки (обычно thunk)
 * @param {Array} deps - зависимости для useEffect (опционально)
 */
export const useInit = (init, clean, deps = []) => {
  const dispatch = useDispatch()

  useEffect(() => {
    // Вызываем init при монтировании
    dispatch(init())

    // Если есть clean, вызываем при размонтировании
    if (clean) {
      return () => {
        dispatch(clean())
      }
    }
    // Если clean не передан, просто выполняем очистку без dispatch
    // (но обычно clean всегда передают)
    return () => {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps) // Если deps пустые — эффект выполняется один раз
}