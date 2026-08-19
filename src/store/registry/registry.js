/**
 * Реестр для хранения счетчиков активных подписчиков и функций отписки.
 * @namespace registry
 */
const registry = {
  counters: {},      // { sliceName: { [idKey]: number } }
  unsubscribes: {},  // { sliceName: { [idKey]: function } }
};

const getDefaultIdKey = () => '__default__';

const getIdKey = (id) => {
  if (id === undefined || id === null || (typeof id === 'object' && Object.keys(id).length === 0)) {
    return getDefaultIdKey();
  }
  return JSON.stringify(id);
};

/**
 * Увеличивает счётчик подписчиков для сущности.
 * @param {string} sliceName – имя слайса
 * @param {any} id – идентификатор (объект или примитив)
 */
export const increment = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.counters[sliceName]) {
    registry.counters[sliceName] = {};
  }
  registry.counters[sliceName][idKey] = (registry.counters[sliceName][idKey] || 0) + 1;
};

/**
 * Уменьшает счётчик подписчиков и возвращает true, если он стал нулевым.
 * @param {string} sliceName
 * @param {any} id
 * @returns {boolean}
 */
export const decrement = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.counters[sliceName]) {
    registry.counters[sliceName] = {};
  }
  registry.counters[sliceName][idKey] = (registry.counters[sliceName][idKey] || 1) - 1;
  return registry.counters[sliceName][idKey] === 0;
};

/**
 * Сохраняет функцию отписки для сущности.
 * @param {string} sliceName
 * @param {any} id
 * @param {Function} unsubscribeFn
 */
export const setUnsubscribe = (sliceName, id, unsubscribeFn) => {
  const idKey = getIdKey(id);
  if (!registry.unsubscribes[sliceName]) {
    registry.unsubscribes[sliceName] = {};
  }
  registry.unsubscribes[sliceName][idKey] = unsubscribeFn;
};

/**
 * Возвращает функцию отписки для сущности.
 * @param {string} sliceName
 * @param {any} id
 * @returns {Function|undefined}
 */
export const getUnsubscribe = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.unsubscribes[sliceName]) {
    return undefined;
  }
  return registry.unsubscribes[sliceName][idKey];
};

/**
 * Удаляет функцию отписки.
 * @param {string} sliceName
 * @param {any} id
 */
export const clearUnsubscribe = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (registry.unsubscribes[sliceName]) {
    delete registry.unsubscribes[sliceName][idKey];
  }
};

/**
 * Возвращает весь реестр (для отладки).
 * @returns {Object}
 */
export const getRegistry = () => registry;

/**
 * Сбрасывает реестр (для тестов).
 */
export const resetRegistry = () => {
  registry.counters = {};
  registry.unsubscribes = {};
};