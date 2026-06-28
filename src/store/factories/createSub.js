
/**
 * Создаёт подписку на события с поддержкой комнат.
 *
 * @param {Object} handlers - { 'eventName': saveAction | { room, save } }
 * @param {Socket} socket - экземпляр сокета (опционально)
 * @returns {Object} { subscribe(dispatch, params) => unsubscribe }
 */
export const createSub = (handlers, socket) => {
  // Разбираем обработчики
  const subscriptions = Object.entries(handlers).map(([event, config]) => {
    const isGlobal = typeof config === 'function'
    return {
      event,
      save: isGlobal ? config : config.save,
      roomTemplate: isGlobal ? null : config.room || null, // строка с {id}
    }
  })

  return {
    subscribe: (dispatch, params = {}) => {
      const entries = subscriptions.map(({ event, save, roomTemplate }) => {
        const handler = (data) => dispatch(save(data))
        socket.on(event, handler)

        let room = null
        if (roomTemplate) {
          // Подставляем параметры в шаблон: 'contest{id}' → 'contest123'
          room = roomTemplate.replace(/\{(\w+)\}/g, (_, key) => params[key] || '')
          if (room) {
            // Вступаем в комнату
            socket.emit('join', room)
          }
        }

        return { event, handler, room }
      })

      // Возвращаем функцию отписки
      return () => {
        entries.forEach(({ event, handler, room }) => {
          socket.off(event, handler)
          if (room) {
            socket.emit('leave', room)
          }
        })
      }
    },
  }
}