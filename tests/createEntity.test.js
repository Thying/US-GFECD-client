import { createEntity } from '../src/store/factories/createEntity';
import { getRegistry } from '../src/store/registry';

describe('createEntity', () => {
  // Сбрасываем registry перед каждым тестом
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

  const mockSub = {
    subscribe: jest.fn(() => jest.fn()),
  };

  const save = jest.fn((data) => ({ type: 'SAVE', payload: data }));
  const reducers = {
    setData: save,
  };

  const initialState = { list: [] };

  it('should create slice with combined state', () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      sub: mockSub,
      save,
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
      sub: mockSub,
      save,
      socket: mockSocket,
    });

    const dispatch = jest.fn();
    const getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });

    await entity.init()(dispatch, getState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', expect.any(Function));
    expect(save).toHaveBeenCalledWith([{ id: 1, name: 'Test' }]);
    expect(mockSub.subscribe).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
  });

  it('should load data on init with params', async () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      sub: mockSub,
      save,
      socket: mockSocket,
    });

    const dispatch = jest.fn();
    const getState = jest.fn().mockReturnValue({ test: { initialized: false, loading: false } });
    const params = { id: '123' };

    await entity.init(params)(dispatch, getState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', params, expect.any(Function));
    expect(save).toHaveBeenCalledWith([{ id: 1, name: 'Test' }]);
    expect(mockSub.subscribe).toHaveBeenCalledWith(dispatch, params);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
  });

  it('should clean data on clean', async () => {
    const entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      sub: mockSub,
      save,
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