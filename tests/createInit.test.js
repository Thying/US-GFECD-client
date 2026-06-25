import { createInit } from '../src/store/factories/createInit'

// Мокаем socket
const mockSocket = {
  emit: jest.fn((event, callback) => {
    callback([{ id: 1, name: 'Test' }])
  })
}

// Мокаем подписку
const mockSub = jest.fn(() => jest.fn())

// Мокаем экшен для сохранения
const save = jest.fn((data) => ({ type: 'SET_DATA', payload: data }))

describe('createInit', () => {
  it('should create init and clean thunks', () => {
    const { init, clean, selectors, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket
    })

    expect(typeof init).toBe('function')
    expect(typeof clean).toBe('function')
    expect(selectors).toBeDefined()
    expect(sliceName).toBeDefined()
  })

  it('should load data on init', async () => {
    const { init, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket
    })

    const dispatch = jest.fn()
    const getState = jest.fn().mockReturnValue({ [sliceName]: { initialized: false, loading: false } })

    await init()(dispatch, getState)

    // Проверяем вызовы
    expect(mockSocket.emit).toHaveBeenCalledWith('test:init', expect.any(Function))
    expect(save).toHaveBeenCalledWith([{ id: 1, name: 'Test' }])
    expect(mockSub).toHaveBeenCalled()
  })

  it('should clean data on clean', async () => {
    const { init, clean, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket
    })

    const dispatch = jest.fn()
    const getState = jest.fn().mockReturnValue({ [sliceName]: { initialized: true, loading: false } })

    // Сначала инициализируем
    await init()(dispatch, getState)
    // Потом чистим
    await clean()(dispatch, getState)

    // Проверяем, что save вызван с пустыми данными
    expect(save).toHaveBeenCalledWith([])
  })
})