const registry = {
  counters: {},      // { sliceName: { [idKey]: number } }
  unsubscribes: {},  // { sliceName: { [idKey]: function } }
};

const getDefaultIdKey = () => '__default__';

const getIdKey = (id) => {
  if (id === undefined || id === null || (typeof id === 'object' && Object.keys(id).length === 0)) {
    return getDefaultIdKey();
  }
  // Сериализуем объект ID в строку для использования в качестве ключа
  return JSON.stringify(id);
};

export const increment = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.counters[sliceName]) {
    registry.counters[sliceName] = {};
  }
  registry.counters[sliceName][idKey] = (registry.counters[sliceName][idKey] || 0) + 1;
};

export const decrement = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.counters[sliceName]) {
    registry.counters[sliceName] = {};
  }
  registry.counters[sliceName][idKey] = (registry.counters[sliceName][idKey] || 1) - 1;
  return registry.counters[sliceName][idKey] === 0;
};

export const setUnsubscribe = (sliceName, id, unsubscribeFn) => {
  const idKey = getIdKey(id);
  if (!registry.unsubscribes[sliceName]) {
    registry.unsubscribes[sliceName] = {};
  }
  registry.unsubscribes[sliceName][idKey] = unsubscribeFn;
};

export const getUnsubscribe = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (!registry.unsubscribes[sliceName]) {
    return undefined;
  }
  return registry.unsubscribes[sliceName][idKey];
};

export const clearUnsubscribe = (sliceName, id) => {
  const idKey = getIdKey(id);
  if (registry.unsubscribes[sliceName]) {
    delete registry.unsubscribes[sliceName][idKey];
  }
};

export const getRegistry = () => registry;

export const resetRegistry = () => {
  registry.counters = {};
  registry.unsubscribes = {};
};