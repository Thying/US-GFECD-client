/**
 * Внутренний реестр для хранения:
 * - counters: { [sliceName]: number } – количество активных подписчиков
 * - unsubscribes: { [sliceName]: function } – функции отписки
 */
const registry = {
    counters: {},
    unsubscribes: {},
  }
  
  export const increment = (sliceName) => {
    registry.counters[sliceName] = (registry.counters[sliceName] || 0) + 1
  }
  
  export const decrement = (sliceName) => {
    registry.counters[sliceName] = (registry.counters[sliceName] || 1) - 1
    return registry.counters[sliceName] === 0 // true, если был последним
  }
  
  export const setUnsubscribe = (sliceName, unsubscribeFn) => {
    registry.unsubscribes[sliceName] = unsubscribeFn
  }
  
  export const getUnsubscribe = (sliceName) => {
    return registry.unsubscribes[sliceName]
  }
  
  export const clearUnsubscribe = (sliceName) => {
    delete registry.unsubscribes[sliceName]
  }
  
  // Для отладки (не обязательно)
  export const getRegistry = () => registry