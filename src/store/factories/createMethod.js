/**
 * Создаёт метод для отправки запросов на сервер.
 * @param {Object} params
 * @param {string} params.call - имя события (сокет)
 * @param {Function} params.save - экшен для сохранения данных (actionCreator)
 * @param {Socket} params.socket - экземпляр сокета (опционально)
 * @returns {Function} thunk (data) => async (dispatch) => ...
 */
export const createMethod = ({ call, save, socket }) => {
    return (data) => async (dispatch) => {
      try {
        const result = await new Promise((resolve, reject) => {
          if (socket) {
            socket.emit(call, data, (response) => {
              if (response && response.error) {
                reject(new Error(response.error))
              } else {
                resolve(response)
              }
            })
          } else {
            reject(new Error('Socket not provided'))
          }
        })
  
        dispatch(save(result))
        return result
      } catch (error) {
        console.error(`[createMethod] ${call} failed:`, error)
        throw error
      }
    }
  }