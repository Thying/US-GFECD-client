import { createSub } from '../src/store/factories/createSub'

describe('createSub with rooms and templates', () => {
  let mockSocket

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    }
  })

  describe('global event (no room)', () => {
    it('should subscribe and unsubscribe without joining any room', () => {
      // save должен возвращать action, который передаётся в dispatch
      const mockSave = jest.fn((data) => data) // возвращает данные для dispatch
      const handlers = {
        contestDeleted: mockSave,
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const unsubscribe = sub.subscribe(dispatch)

      expect(mockSocket.on).toHaveBeenCalledWith('contestDeleted', expect.any(Function))
      expect(mockSocket.emit).not.toHaveBeenCalledWith('join', expect.any(String))

      const handler = mockSocket.on.mock.calls[0][1]
      const data = { id: '123' }
      handler(data)

      expect(mockSave).toHaveBeenCalledWith(data)
      expect(dispatch).toHaveBeenCalledWith(data) // save вернул данные, dispatch получил их

      unsubscribe()
      expect(mockSocket.off).toHaveBeenCalledWith('contestDeleted', expect.any(Function))
      expect(mockSocket.emit).not.toHaveBeenCalledWith('leave', expect.any(String))
    })
  })

  describe('static room', () => {
    it('should join and leave a static room', () => {
      const mockSave = jest.fn((data) => data)
      const handlers = {
        contestDeleted: {
          room: 'admin',
          save: mockSave,
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const unsubscribe = sub.subscribe(dispatch)

      expect(mockSocket.on).toHaveBeenCalledWith('contestDeleted', expect.any(Function))
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'admin')

      const handler = mockSocket.on.mock.calls[0][1]
      const data = { id: '123' }
      handler(data)

      expect(mockSave).toHaveBeenCalledWith(data)
      expect(dispatch).toHaveBeenCalledWith(data)

      unsubscribe()
      expect(mockSocket.off).toHaveBeenCalledWith('contestDeleted', expect.any(Function))
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'admin')
    })
  })

  describe('room with single parameter {id}', () => {
    it('should substitute {id} with params.id', () => {
      const mockSave = jest.fn((data) => data)
      const handlers = {
        contestPageUpdated: {
          room: 'contest{id}',
          save: mockSave,
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const params = { id: '123' }
      const unsubscribe = sub.subscribe(dispatch, params)

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'contest123')

      unsubscribe()
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'contest123')
    })

    it('should use empty string if parameter is missing', () => {
      const handlers = {
        contestPageUpdated: {
          room: 'contest{id}',
          save: jest.fn((data) => data),
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const params = {}
      const unsubscribe = sub.subscribe(dispatch, params)

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'contest')

      unsubscribe()
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'contest')
    })
  })

  describe('room with multiple parameters', () => {
    it('should substitute multiple placeholders', () => {
      const mockSave = jest.fn((data) => data)
      const handlers = {
        contestThemeUpdated: {
          room: 'contest{id}/theme/{themeId}',
          save: mockSave,
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const params = { id: '123', themeId: '456' }
      const unsubscribe = sub.subscribe(dispatch, params)

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'contest123/theme/456')

      unsubscribe()
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'contest123/theme/456')
    })

    it('should handle missing parameters by leaving placeholders', () => {
      const handlers = {
        contestThemeUpdated: {
          room: 'contest{id}/theme/{themeId}',
          save: jest.fn((data) => data),
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      const params = { id: '123' }
      const unsubscribe = sub.subscribe(dispatch, params)

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'contest123/theme/')

      unsubscribe()
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'contest123/theme/')
    })
  })

  describe('event handling with rooms', () => {
    it('should call save action with data and dispatch result', () => {
      const mockSave = jest.fn((data) => ({ type: 'UPDATE', payload: data }))
      const handlers = {
        contestPageUpdated: {
          room: 'contest{id}',
          save: mockSave,
        },
      }
      const sub = createSub(handlers, mockSocket)
      const dispatch = jest.fn()

      sub.subscribe(dispatch, { id: '123' })

      const handler = mockSocket.on.mock.calls[0][1]
      const data = { id: '123', title: 'Test' }
      handler(data)

      expect(mockSave).toHaveBeenCalledWith(data)
      expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE', payload: data })
    })
  })
})