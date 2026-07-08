import { createEntity } from '../src/store/factories/createEntity';
import { resetRegistry } from '../src/store/registry';

describe('createEntity', () => {
  const mockSocket = {
    emit: jest.fn((event, params, callback) => {
      callback([{ id: 1, name: 'Test' }]);
    }),
  };

  const mockSub = {
    subscribe: jest.fn(() => jest.fn()),
  };

  const initialState = { list: [] };
  const save = jest.fn((data) => ({ type: 'test/setData', payload: data }));
  const reducers = {
    setData: (state, action) => {
      state.list = action.payload;
    },
  };

  let entity;
  let reducer;
  let mockState;

  beforeEach(() => {
    resetRegistry(); // Сбрасываем счётчики и отписки между тестами
    jest.clearAllMocks();

    entity = createEntity({
      name: 'test',
      initialState,
      reducers,
      call: 'test:get',
      sub: mockSub,
      save,
      socket: mockSocket,
    });
    reducer = entity.slice.reducer;
    mockState = {
      test: reducer(undefined, { type: '@@INIT' }),
    };
  });

  it('should create slice with combined state', () => {
    expect(entity.slice).toBeDefined();
    expect(entity.actions).toBeDefined();
    expect(entity.init).toBeInstanceOf(Function);
    expect(entity.clean).toBeInstanceOf(Function);
    expect(entity.selectors).toBeDefined();
  });

  it('should load data on init', async () => {
    const dispatch = jest.fn((action) => {
      mockState.test = reducer(mockState.test, action);
    });
    const getState = jest.fn(() => mockState);

    await entity.init()(dispatch, getState);

    expect(mockSocket.emit).toHaveBeenCalledWith('test:get', {}, expect.any(Function));
    expect(save).toHaveBeenCalledWith([{ id: 1, name: 'Test' }]);
    expect(mockSub.subscribe).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/start' }));
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/success' }));
    expect(mockState.test.initialized).toBe(true);
    expect(mockState.test.loading).toBe(false);
    expect(mockState.test.list).toEqual([{ id: 1, name: 'Test' }]);
  });

  it('should clean data on clean', async () => {
    const dispatch = jest.fn((action) => {
      mockState.test = reducer(mockState.test, action);
    });
    const getState = jest.fn(() => mockState);

    // Инициализируем
    await entity.init()(dispatch, getState);
    expect(mockState.test.initialized).toBe(true);

    // Вызываем clean
    await entity.clean()(dispatch, getState);

    // Проверяем, что reset был вызван
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'test/reset' }));
    // Проверяем, что состояние сбросилось
    expect(mockState.test.initialized).toBe(false);
    expect(mockState.test.loading).toBe(false);
    expect(mockState.test.error).toBe(null);
    expect(mockState.test.list).toEqual([]);
  });
});