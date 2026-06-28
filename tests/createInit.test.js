import { createInit } from '../src/store/factories/createInit'

const mockSocket = {
  emit: jest.fn((event, params, callback) => {
    callback([{ id: 1, name: 'Test' }])
  }),
}

const mockSub = {
  subscribe: jest.fn(() => jest.fn()),
}

const save = jest.fn((data) => ({ type: 'SET_DATA', payload: data }))

describe('createInit', () => {
  it('should create init and clean thunks', () => {
    const { init, clean, selectors, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket,
    })

    expect(typeof init).toBe('function')
    expect(typeof clean).toBe('function')
    expect(selectors).toBeDefined()
    expect(sliceName).toBeDefined()
  })

  it('should load data on init with params', async () => {
    const { init, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket,
    })

    const dispatch = jest.fn()
    const getState = jest.fn().mockReturnValue({ [sliceName]: { initialized: false, loading: false } })

    const params = { id: 'test-id' }
    await init(params)(dispatch, getState)

    // Проверяем вызов emit с параметрами
    expect(mockSocket.emit).toHaveBeenCalledWith('test:init', params, expect.any(Function))
    expect(save).toHaveBeenCalledWith([{ id: 1, name: 'Test' }])
    expect(mockSub.subscribe).toHaveBeenCalledWith(dispatch, params)
  })

  it('should clean data on clean', async () => {
    const { init, clean, sliceName } = createInit({
      call: 'test:init',
      save,
      sub: mockSub,
      socket: mockSocket,
    })

    const dispatch = jest.fn()
    const getState = jest.fn().mockReturnValue({ [sliceName]: { initialized: true, loading: false } })

    await init()(dispatch, getState)
    await clean()(dispatch, getState)

    // Проверяем, что save вызван с пустыми данными
    expect(save).toHaveBeenCalledWith([])
  })
})