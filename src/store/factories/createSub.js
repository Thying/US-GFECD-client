/**
 * Создаёт подписку на события сервера.
 * @param {Object} handlers - { 'eventName': actionCreator }
 * @param {Socket} socket - экземпляр сокета (опционально, если не передан, использует глобальный)
 * @returns {Function} subscribe(dispatch) => unsubscribe
 */
export const createSub = (handlers, socket) => {
    return (dispatch) => {
      const entries = Object.entries(handlers)
      const boundHandlers = entries.map(([event, actionCreator]) => {
        const handler = (data) => dispatch(actionCreator(data))
        if (socket) {
          socket.on(event, handler)
        } else {
          // если сокет не передан, предполагаем, что он уже создан где-то глобально
          // но лучше явно передавать
          console.warn('createSub: socket not provided, event not bound')
        }
        return { event, handler }
      })
  
      // Возвращаем функцию отписки
      return () => {
        boundHandlers.forEach(({ event, handler }) => {
          if (socket) {
            socket.off(event, handler)
          }
        })
      }
    }
  }