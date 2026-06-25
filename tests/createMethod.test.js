import { createMethod } from '../src/store/factories/createMethod'

beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })
  
  afterAll(() => {
    console.error.mockRestore()
  })

describe('createMethod', () => {
  it('should emit event and dispatch save action', async () => {
    const mockSocket = {
      emit: jest.fn((event, data, callback) => {
        callback({ id: 1, name: 'Test' })
      })
    }
    const save = jest.fn()
    const method = createMethod({
      call: 'test:method',
      save,
      socket: mockSocket
    })

    const dispatch = jest.fn()
    await method({ name: 'Test' })(dispatch)

    // Проверяем emit
    expect(mockSocket.emit).toHaveBeenCalledWith('test:method', { name: 'Test' }, expect.any(Function))

    // Проверяем dispatch
    expect(save).toHaveBeenCalledWith({ id: 1, name: 'Test' })
    expect(dispatch).toHaveBeenCalledWith(save.mock.results[0].value)
  })

  it('should handle errors', async () => {
    const mockSocket = {
      emit: jest.fn((event, data, callback) => {
        callback({ error: 'Something went wrong' })
      })
    }
    const method = createMethod({
      call: 'test:method',
      save: jest.fn(),
      socket: mockSocket
    })

    await expect(method({})(jest.fn())).rejects.toThrow('Something went wrong')
  })
})