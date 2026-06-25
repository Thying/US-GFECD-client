import { createSub } from '../src/store/factories/createSub'

describe('createSub', () => {
  it('should subscribe to events and return unsubscribe', () => {
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn()
    }
    const handlers = { 'test:event': jest.fn() }
    const subscribe = createSub(handlers, mockSocket)
    const dispatch = jest.fn()

    const unsubscribe = subscribe(dispatch)

    // Проверяем подписку
    expect(mockSocket.on).toHaveBeenCalledWith('test:event', expect.any(Function))

    // Вызываем обработчик
    const handler = mockSocket.on.mock.calls[0][1]
    handler('test data')
    expect(handlers['test:event']).toHaveBeenCalledWith('test data')

    // Отписываемся
    unsubscribe()
    expect(mockSocket.off).toHaveBeenCalledWith('test:event', expect.any(Function))
  })
})