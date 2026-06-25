import { createSub } from './createSub'

describe('createSub', () => {
  it('should return a function that subscribes and unsubscribes', () => {
    const mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
    }
    const handlers = { 'test:event': jest.fn() }
    const subscribe = createSub(handlers, mockSocket)
    const dispatch = jest.fn()

    const unsubscribe = subscribe(dispatch)

    expect(mockSocket.on).toHaveBeenCalledWith('test:event', expect.any(Function))

    // Вызов обработчика
    const handler = mockSocket.on.mock.calls[0][1]
    handler('test data')
    expect(handlers['test:event']).toHaveBeenCalledWith('test data')

    // Отписка
    unsubscribe()
    expect(mockSocket.off).toHaveBeenCalledWith('test:event', expect.any(Function))
  })
})