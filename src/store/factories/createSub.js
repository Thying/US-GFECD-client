/**
 * Создаёт подписку на события сервера, привязанную к сущности.
 *
 * @param {Object} handlers - объект, где ключ — имя события, значение — экшен или строка с именем экшена из entity.actions, или объект { room, save }
 * @param {Object} entity - сущность, созданная через createEntity (должна содержать actions)
 * @param {Socket} socket - экземпляр Socket.IO
 * @returns {Object} { subscribe(dispatch, params) => unsubscribe }
 */
export const createSub = (handlers, entity, socket) => {
  if (!entity || typeof entity !== 'object' || !entity.actions) {
    throw new Error('createSub: second argument must be an entity created with createEntity');
  }

  const { actions } = entity;

  const resolveAction = (save) => {
    if (typeof save === 'string') {
      const action = actions[save];
      if (!action) {
        throw new Error(`createSub: action "${save}" not found in entity.actions`);
      }
      return action;
    }
    return save;
  };

  const processedHandlers = {};
  for (const [event, config] of Object.entries(handlers)) {
    if (typeof config === 'function') {
      processedHandlers[event] = config;
    } else if (typeof config === 'string') {
      processedHandlers[event] = resolveAction(config);
    } else if (config && typeof config === 'object') {
      const { save, room } = config;
      if (save) {
        processedHandlers[event] = {
          room,
          save: resolveAction(save),
        };
      } else {
        processedHandlers[event] = config;
      }
    } else {
      processedHandlers[event] = config;
    }
  }

  const subscriptions = Object.entries(processedHandlers).map(([event, config]) => {
    const isGlobal = typeof config === 'function' || typeof config === 'string';
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