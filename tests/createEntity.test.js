import { createEntity } from '../src/store/factories/createEntity';
import { getRegistry } from '../src/store/registry';

describe('createEntity', () => {
  beforeEach(() => {
    const reg = getRegistry();
    reg.counters = {};
    reg.unsubscribes = {};
  });

  const mockSocket = {
    emit: jest.fn((event, ...args) => {
      const callback = args.length === 1 ? args[0] : args[1];
      callback([{ id: 1, name: 'Test' }]);
    }),
  };

  const reducers = {
    setData: (state, action) => {
      state.list = action.payload;
    },
  };

  const initialState = { list: [] };

  it('should create slice with combined state', () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    expect(entity.slice).toBeDefined();
    expect(entity.actions).toBeDefined();
    expect(entity.init).toBeInstanceOf(Function);
    expect(entity.clean).toBeInstanceOf(Function);
    expect(entity.selectors).toBeDefined();
  });

  it('should load data on init without params', async () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const dispatch = jest.fn();
    const getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });

    await entity.init()(dispatch, getState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', expect.any(Function));

    const setDataAction = dispatch.mock.calls.find(call => call[0].type === 'test/setData');
    expect(setDataAction).toBeDefined();
    expect(setDataAction[0].payload).toEqual([{ id: 1, name: 'Test' }]);

    // В новой версии createEntity не использует sub, поэтому проверяем только dispatch
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
  });

  it('should load data on init with params', async () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const dispatch = jest.fn();
    const getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });
    const params = { id: '123' };

    await entity.init(params)(dispatch, getState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', params, expect.any(Function));

    const setDataAction = dispatch.mock.calls.find(call => call[0].type === 'test/setData');
    expect(setDataAction).toBeDefined();
    expect(setDataAction[0].payload).toEqual([{ id: 1, name: 'Test' }]);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
  });

  it('should clean data on clean', async () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      save: 'setData',
      socket: mockSocket,
    });

    const dispatch = jest.fn();
    const getState = jest.fn().mockReturnValue({ test: { initialized: true, loading: false } });

    // Устанавливаем счётчик в 1, чтобы decrement вернул true
    const reg = getRegistry();
    reg.counters['test'] = 1;

    await entity.clean()(dispatch, getState);

    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
  });
});