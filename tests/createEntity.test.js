import { createEntity } from '../src/store/factories/createEntity';
import { getRegistry } from '../src/store/registry';

describe('createEntity', () => {
  beforeEach(() => {
    const reg = getRegistry();
    reg.counters = {};
    reg.unsubscribes = {};
  });

  // ------------------------------------------------------------
  // 1. Создание сущности
  // ------------------------------------------------------------
  describe('creation', () => {
    const mockSocket = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
    const reducers = {
      setData: (state, action) => { state.list = action.payload; },
      clearData: (state) => { state.list = []; },
    };
    const initialState = { list: [] };

    it('should create slice with combined state', () => {
      const entity = createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: {
          dataUpdated: 'setData',
        },
        socket: mockSocket,
      });

      expect(entity.slice).toBeDefined();
      expect(entity.actions).toBeDefined();
      expect(entity.init).toBeInstanceOf(Function);
      expect(entity.clean).toBeInstanceOf(Function);
      expect(entity.selectors).toBeDefined();
    });

    it('should throw if save action not found', () => {
      expect(() => {
        createEntity({
          name: 'test',
          initialState,
          reducers,
          call: 'test:get',
          save: 'nonExistent',
          socket: mockSocket,
        });
      }).toThrow(/reducer "nonExistent" not found/);
    });

    it('should throw if handler action not found', () => {
      expect(() => {
        createEntity({
          name: 'test',
          initialState,
          reducers,
          call: 'test:get',
          save: 'setData',
          handlers: {
            dataUpdated: 'nonExistent',
          },
          socket: mockSocket,
        });
      }).toThrow(/action "nonExistent" not found/);
    });
  });

  // ------------------------------------------------------------
  // 2. Инициализация (init)
  // ------------------------------------------------------------
  describe('init', () => {
    let mockSocket;
    let entity;
    let dispatch;
    let getState;

    beforeEach(() => {
      mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      };
      const reducers = {
        setData: (state, action) => { state.list = action.payload; },
      };
      const initialState = { list: [] };

      entity = createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: {
          dataUpdated: 'setData',
        },
        socket: mockSocket,
      });

      dispatch = jest.fn();
      getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });
    });

    it('should load data and activate subscription (without params)', async () => {
      mockSocket.emit.mockImplementation((event, callback) => {
        callback([{ id: 1, name: 'Test' }]);
      });

      await entity.init()(dispatch, getState);

      expect(mockSocket.emit).toHaveBeenCalledWith('test:get', expect.any(Function));

      const setDataAction = dispatch.mock.calls.find(call => call[0].type === 'test/setData');
      expect(setDataAction).toBeDefined();
      expect(setDataAction[0].payload).toEqual([{ id: 1, name: 'Test' }]);

      expect(mockSocket.on).toHaveBeenCalledWith('dataUpdated', expect.any(Function));
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
    });

    it('should load data and activate subscription (with params)', async () => {
      mockSocket.emit.mockImplementation((event, params, callback) => {
        callback([{ id: 2, name: 'Param' }]);
      });

      const params = { id: '123' };
      await entity.init(params)(dispatch, getState);

      expect(mockSocket.emit).toHaveBeenCalledWith('test:get', params, expect.any(Function));

      const setDataAction = dispatch.mock.calls.find(call => call[0].type === 'test/setData');
      expect(setDataAction[0].payload).toEqual([{ id: 2, name: 'Param' }]);
    });

    it('should not load twice if already initialized', async () => {
      getState.mockReturnValue({ test: { initialized: true, loading: false } });
      await entity.init()(dispatch, getState);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should not load twice if already loading', async () => {
      getState.mockReturnValue({ test: { initialized: false, loading: true } });
      await entity.init()(dispatch, getState);
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('should handle error from server', async () => {
  // Заглушаем console.error, чтобы не засорять вывод
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  mockSocket.emit.mockImplementation((event, callback) => {
    callback({ error: 'Server error' });
  });

  await entity.init()(dispatch, getState);

  const failAction = dispatch.mock.calls.find(call => call[0].type === 'test/fail');
  expect(failAction).toBeDefined();
  expect(failAction[0].payload).toBe('Server error');

  // Восстанавливаем console.error
  consoleErrorSpy.mockRestore();
});
  });

  // ------------------------------------------------------------
  // 3. Clean (очистка)
  // ------------------------------------------------------------
  describe('clean', () => {
    let mockSocket;
    let entity;
    let dispatch;
    let getState;
    let reg;

    beforeEach(() => {
      mockSocket = {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
      };
      const reducers = {
        setData: (state, action) => { state.list = action.payload; },
      };
      const initialState = { list: [] };

      entity = createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: {
          dataUpdated: 'setData',
        },
        socket: mockSocket,
      });

      dispatch = jest.fn();
      getState = jest.fn().mockReturnValue({ test: { initialized: true, loading: false } });
      reg = getRegistry();
      reg.counters['test'] = 1;
    });

    it('should unsubscribe and reset state', async () => {
      const unsubscribeFn = jest.fn();
      reg.unsubscribes['test'] = unsubscribeFn;

      await entity.clean()(dispatch, getState);

      expect(unsubscribeFn).toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
      expect(reg.unsubscribes['test']).toBeUndefined();
    });

    it('should not clean if not initialized', async () => {
      getState.mockReturnValue({ test: { initialized: false, loading: false } });
      await entity.clean()(dispatch, getState);
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
    });

    it('should not clean if counter > 1 (not last subscriber)', async () => {
      reg.counters['test'] = 2;
      await entity.clean()(dispatch, getState);
      expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
    });
  });

  // ------------------------------------------------------------
  // 4. Подписка с комнатами
  // ------------------------------------------------------------
  describe('subscription with rooms', () => {
    let mockSocket;
    let entity;
    let dispatch;
    let getState;

    beforeEach(() => {
      mockSocket = {
        emit: jest.fn((event, ...args) => {
          if (event === 'test:get') {
            const callback = args.length === 1 ? args[0] : args[1];
            callback([{ id: 1 }]);
          }
        }),
        on: jest.fn(),
        off: jest.fn(),
      };
      const reducers = {
        setData: (state, action) => { state.list = action.payload; },
      };
      const initialState = { list: [] };

      entity = createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: {
          roomUpdated: {
            room: 'room{id}',
            save: 'setData',
          },
        },
        socket: mockSocket,
      });

      dispatch = jest.fn();
      getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });
    });

    it('should join room on init with params', async () => {
      await entity.init({ id: '123' })(dispatch, getState);
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'room123');
    });

    it('should leave room on clean', async () => {
  // 1. Вызываем init с параметрами, чтобы вступить в комнату
  await entity.init({ id: '123' })(dispatch, getState);
  // Проверяем, что join был вызван
  expect(mockSocket.emit).toHaveBeenCalledWith('join', 'room123');

  // 2. Обновляем getState для clean
  getState.mockReturnValue({ test: { initialized: true, loading: false } });
  const reg = getRegistry();
  reg.counters['test'] = 1; // так как после init счётчик увеличился

  // 3. Вызываем clean
  await entity.clean()(dispatch, getState);

  // 4. Проверяем, что leave вызван
  expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'room123');
});

    it('should handle missing params in room template', async () => {
      await entity.init()(dispatch, getState); // без params
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'room');
    });
  });

  // ------------------------------------------------------------
  // 5. Селекторы
  // ------------------------------------------------------------
  describe('selectors', () => {
    const mockSocket = { emit: jest.fn(), on: jest.fn(), off: jest.fn() };
    const reducers = { setData: (state, action) => { state.list = action.payload; } };
    const initialState = { list: [] };

    it('should return correct data and flags', () => {
      const entity = createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        socket: mockSocket,
      });

      const state = {
        test: {
          list: [1, 2, 3],
          loading: true,
          error: 'Error',
          initialized: false,
        },
      };

      expect(entity.selectors.selectData(state)).toEqual({ list: [1, 2, 3], loading: true, error: 'Error', initialized: false });
      expect(entity.selectors.selectState(state)).toEqual(state.test);
      expect(entity.selectors.selectLoading(state)).toBe(true);
      expect(entity.selectors.selectError(state)).toBe('Error');
      expect(entity.selectors.selectInitialized(state)).toBe(false);
    });
  });
});