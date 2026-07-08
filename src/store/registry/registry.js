const registry = {
  counters: {},
  unsubscribes: {},
};

export const increment = (sliceName) => {
  registry.counters[sliceName] = (registry.counters[sliceName] || 0) + 1;
};

export const decrement = (sliceName) => {
  registry.counters[sliceName] = (registry.counters[sliceName] || 1) - 1;
  return registry.counters[sliceName] === 0;
};

export const setUnsubscribe = (sliceName, unsubscribeFn) => {
  registry.unsubscribes[sliceName] = unsubscribeFn;
};

export const getUnsubscribe = (sliceName) => {
  return registry.unsubscribes[sliceName];
};

export const clearUnsubscribe = (sliceName) => {
  delete registry.unsubscribes[sliceName];
};

export const getRegistry = () => registry;

// Добавляем функцию сброса (для тестов)
export const resetRegistry = () => {
  registry.counters = {};
  registry.unsubscribes = {};
};