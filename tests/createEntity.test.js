import { createEntity } from '../src/store/factories/createEntity';
import { getRegistry } from '../src/store/registry';

describe('createEntity', () => {
  let mockSocket;
  let mockDispatch;
  let mockGetState;
  const initialState = { list: [] };
  const reducers = {
    setData: (state, action) => { state.list = action.payload; },
    clearData: (state) => { state.list = []; },
  };
  const testId = { id: 123 };

  beforeEach(() => {
    const reg = getRegistry();
    reg.counters = {};
    reg.unsubscribes = {};

    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      if (event === 'test:get') {
        callback([{ id: 1 }]);
      } else {
        callback({});
      }
    });

    mockDispatch = jest.fn();
    mockGetState = jest.fn().mockReturnValue({
      test: {
        '{"id":123}': {
          list: [],
          loading: false,
          error: null,
          initialized: false,
        },
      },
    });
  });

  test('should create entity factory', () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    expect(entityFactory).toBeInstanceOf(Function);
    expect(entityFactory.slice).toBeDefined();
    expect(entityFactory.actions).toBeDefined();

    const instance = entityFactory(testId);
    expect(instance.init).toBeInstanceOf(Function);
    expect(instance.clean).toBeInstanceOf(Function);
    expect(instance.selectors).toBeDefined();
  });

  test('should load data on init', async () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const entity = entityFactory(testId);
    await entity.init()(mockDispatch, mockGetState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', testId, expect.any(Function));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'test/setData',
      payload: [{ id: 1 }],
      meta: { id: testId },
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'test/start',
      payload: { id: testId },
    });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'test/success',
      payload: { id: testId },
    });
  });

  test('should subscribe to handlers if provided', async () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      handlers: {
        dataUpdated: 'setData',
        dataCleared: 'clearData',
      },
      socket: mockSocket,
    });

    const entity = entityFactory(testId);
    await entity.init()(mockDispatch, mockGetState);

    expect(mockSocket.on).toHaveBeenCalledWith('dataUpdated', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('dataCleared', expect.any(Function));

    const handler = mockSocket.on.mock.calls.find(call => call[0] === 'dataUpdated')[1];
    handler({ id: 2 });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'test/setData',
      payload: { id: 2 },
      meta: { id: testId },
    });
  });

  test('should call global hooks on init', async () => {
    const onSend = jest.fn((params) => params);
    const onSave = jest.fn((response) => ({ ...response, transformed: true }));
    const onDone = jest.fn();

    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
      onSend,
      onSave,
      onDone,
    });

    const entity = entityFactory(testId);
    await entity.init()(mockDispatch, mockGetState);

    expect(onSend).toHaveBeenCalledWith(testId, expect.any(Object));
    expect(onSave).toHaveBeenCalledWith([{ id: 1 }], expect.any(Object));
    // onDone получает результат onSave (объект с transformed)
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ 0: { id: 1 }, transformed: true }),
      expect.any(Object)
    );
  });

  test('should throw CFG-01 if save action not found', () => {
    expect(() => {
      createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'nonExistent',
        socket: mockSocket,
      });
    }).toThrow(expect.objectContaining({ code: 'CFG-01' }));
  });

  test('should throw CFG-06 if handler references non-existent action', () => {
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
    }).toThrow(expect.objectContaining({ code: 'CFG-06' }));
  });

  test('should throw CFG-02 if socket not provided for subscription', () => {
    expect(() => {
      createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: {
          dataUpdated: 'setData',
        },
      });
    }).toThrow(expect.objectContaining({ code: 'CFG-02' }));
  });

  test('should throw CFG-03 if handlers is not an object', () => {
    expect(() => {
      createEntity({
        name: 'test',
        initialState,
        reducers,
        call: 'test:get',
        save: 'setData',
        handlers: 'not an object',
        socket: mockSocket,
      });
    }).toThrow(expect.objectContaining({ code: 'CFG-03' }));
  });

  test('should throw NET-03 if server returns error', async () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      callback({ error: 'Server error' });
    });

    const entity = entityFactory(testId);
    await expect(entity.init()(mockDispatch, mockGetState)).rejects.toThrow(
      expect.objectContaining({ code: 'NET-03' })
    );
  });

  test('should clean data and unsubscribe on last subscriber', async () => {
    const entityFactory = createEntity({
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

    const entity = entityFactory(testId);
    await entity.init()(mockDispatch, mockGetState);

    // Проверяем, что подписка была создана в registry
    const reg = getRegistry();
    const unsub = reg.unsubscribes['test'] && reg.unsubscribes['test']['{"id":123}'];
    expect(unsub).toBeDefined();
    expect(typeof unsub).toBe('function');

    mockGetState.mockReturnValue({
      test: {
        '{"id":123}': {
          list: [{ id: 1 }],
          loading: false,
          initialized: true,
          error: null,
        },
      },
    });

    await entity.clean()(mockDispatch, mockGetState);

    expect(mockSocket.off).toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'test/reset',
      payload: { id: testId },
    });
  });

  test('should NOT clean if there are other subscribers', async () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const reg = getRegistry();
    reg.counters['test'] = { '{"id":123}': 2 };

    mockGetState.mockReturnValue({
      test: {
        '{"id":123}': {
          list: [],
          loading: false,
          initialized: true,
          error: null,
        },
      },
    });

    const entity = entityFactory(testId);
    await entity.clean()(mockDispatch, mockGetState);

    expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
  });

  test('should log warning LIF-01 if clean called before init', async () => {
    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    mockGetState.mockReturnValue({ test: {} });

    const entity = entityFactory(testId);
    await entity.clean()(mockDispatch, mockGetState);

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('LIF-01'),
      expect.anything()
    );
    consoleWarnSpy.mockRestore();
  });

  test('should call onClean and onEnd during clean', async () => {
    const onClean = jest.fn();
    const onEnd = jest.fn();

    const entityFactory = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      handlers: {
        dataUpdated: 'setData',
      },
      socket: mockSocket,
      onClean,
      onEnd,
    });

    const entity = entityFactory(testId);
    await entity.init()(mockDispatch, mockGetState);

    mockGetState.mockReturnValue({
      test: {
        '{"id":123}': {
          list: [{ id: 1 }],
          loading: false,
          initialized: true,
          error: null,
        },
      },
    });

    await entity.clean()(mockDispatch, mockGetState);

    expect(onClean).toHaveBeenCalledWith(expect.any(Object));
    expect(onEnd).toHaveBeenCalledWith(expect.any(Object));
  });
});