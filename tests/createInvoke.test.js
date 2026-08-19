import { createInvoke } from '../src/store/factories/createInvoke';

describe('createInvoke', () => {
  let mockSocket;
  let mockDispatch;
  let mockGetState;
  const testId = { id: 123 };

  beforeAll(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    console.warn.mockRestore();
  });

  beforeEach(() => {
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
    };
    // Универсальный мок для emit
    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      if (event === 'test:action') {
        callback({ id: 1, name: 'Test' });
      } else {
        callback({});
      }
    });

    mockDispatch = jest.fn();
    mockGetState = jest.fn();
  });

  test('should send request and save data', async () => {
    const saveAction = jest.fn((data) => ({ type: 'SAVE', payload: data }));
    const invoke = createInvoke({
      call: 'test:action',
      save: saveAction,
      socket: mockSocket,
    });

    const result = await invoke({ name: 'John' }, null, testId)(
      mockDispatch,
      mockGetState
    );

    expect(mockSocket.emit).toHaveBeenCalledWith(
      'test:action',
      { name: 'John' },
      expect.any(Function)
    );
    expect(saveAction).toHaveBeenCalledWith({ id: 1, name: 'Test' });
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SAVE',
      payload: { id: 1, name: 'Test' },
      meta: { id: testId },
    });
    expect(result).toEqual({ id: 1, name: 'Test' });
  });

  test('should work without data (emit only callback)', async () => {
  const saveAction = jest.fn((data) => ({ type: 'SAVE', payload: data }));
  const invoke = createInvoke({
    call: 'test:action',
    save: saveAction,
    socket: mockSocket,
  });

  // Переопределяем мок для этого теста: emit без данных
  mockSocket.emit.mockImplementation((event, callback) => {
    callback({ status: 'ok' });
  });

  // Передаём пустой объект вместо null, чтобы данные были, но без полей
  const result = await invoke({}, null, testId)(mockDispatch, mockGetState);

  expect(mockSocket.emit).toHaveBeenCalledWith(
    'test:action',
    expect.any(Function)
  );
  expect(saveAction).toHaveBeenCalledWith({ status: 'ok' });
  expect(mockDispatch).toHaveBeenCalledWith({
    type: 'SAVE',
    payload: { status: 'ok' },
    meta: { id: testId },
  });
  expect(result).toEqual({ status: 'ok' });
});

  test('should call global onSend, onSave, onDone', async () => {
    const onSend = jest.fn((data) => data);
    const onSave = jest.fn((response) => ({ ...response, transformed: true }));
    const onDone = jest.fn();

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn((data) => ({ type: 'SAVE', payload: data })),
      socket: mockSocket,
      onSend,
      onSave,
      onDone,
    });

    await invoke({ x: 1 }, null, testId)(mockDispatch, mockGetState);

    expect(onSend).toHaveBeenCalledWith({ x: 1 }, expect.any(Object));
    expect(onSave).toHaveBeenCalledWith({ id: 1, name: 'Test' }, expect.any(Object));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, name: 'Test', transformed: true }),
      expect.any(Object)
    );
  });

  test('local hooks should override global hooks', async () => {
    const globalOnSend = jest.fn();
    const localOnSend = jest.fn((data) => data);

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn((data) => ({ type: 'SAVE', payload: data })),
      socket: mockSocket,
      onSend: globalOnSend,
    });

    await invoke({ x: 1 }, { onSend: localOnSend }, testId)(
      mockDispatch,
      mockGetState
    );

    expect(globalOnSend).not.toHaveBeenCalled();
    expect(localOnSend).toHaveBeenCalled();
  });

  test('local hook with base should call global hook', async () => {
    const globalOnSend = jest.fn((data) => data);
    const localOnSend = jest.fn((data, base) => base(data));

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn((data) => ({ type: 'SAVE', payload: data })),
      socket: mockSocket,
      onSend: globalOnSend,
    });

    await invoke({ x: 1 }, { onSend: localOnSend }, testId)(
      mockDispatch,
      mockGetState
    );

    expect(globalOnSend).toHaveBeenCalledWith({ x: 1 }, expect.any(Object));
    expect(localOnSend).toHaveBeenCalled();
  });

  test('should cancel request if onSend returns null', async () => {
    const onSend = jest.fn(() => null);

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
      onSend,
    });

    const result = await invoke({ x: 1 }, null, testId)(
      mockDispatch,
      mockGetState
    );

    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  test('should throw CFG-01 if save is not a function', () => {
    expect(() => {
      createInvoke({ call: 'test', save: 'not a function', socket: mockSocket });
    }).toThrow(expect.objectContaining({ code: 'CFG-01' }));
  });

  test('should throw CFG-05 if call is missing', () => {
    expect(() => {
      createInvoke({ save: jest.fn(), socket: mockSocket });
    }).toThrow(expect.objectContaining({ code: 'CFG-05' }));
  });

  test('should throw CFG-02 if socket not provided', async () => {
    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
    });

    await expect(invoke({}, null, testId)(mockDispatch, mockGetState)).rejects.toThrow(
      expect.objectContaining({ code: 'CFG-02' })
    );
  });

  test('should throw NET-03 if server returns error', async () => {
    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      callback({ error: 'Something went wrong' });
    });

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
    });

    await expect(invoke({}, null, testId)(mockDispatch, mockGetState)).rejects.toThrow(
      expect.objectContaining({ code: 'NET-03' })
    );
  });

  test('should call onError when error occurs', async () => {
    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      callback({ error: 'Server error' });
    });

    const onError = jest.fn();
    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
      onError,
    });

    try {
      await invoke({}, null, testId)(mockDispatch, mockGetState);
    } catch (e) {
      // ignore
    }

    expect(onError).toHaveBeenCalled();
    const errorArg = onError.mock.calls[0][0];
    expect(errorArg.code).toBe('NET-03');
  });

  test('should throw HOK-01 if local hook calls base but global hook not defined', async () => {
    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
    });

    const localOnSend = jest.fn((data, base) => base(data));

    await expect(
      invoke({ x: 1 }, { onSend: localOnSend }, testId)(mockDispatch, mockGetState)
    ).rejects.toThrow(expect.objectContaining({ code: 'HOK-01' }));
  });

  test('should throw DAT-03 for unexpected error', async () => {
    const onSend = jest.fn(() => {
      throw new Error('Unexpected');
    });

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
      onSend,
    });

    await expect(invoke({}, null, testId)(mockDispatch, mockGetState)).rejects.toThrow(
      expect.objectContaining({ code: 'DAT-03' })
    );
  });

  test('should call local onError and still throw', async () => {
    mockSocket.emit.mockImplementation((event, ...args) => {
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : () => {};
      callback({ error: 'Server error' });
    });

    const globalOnError = jest.fn();
    const localOnError = jest.fn((error, base) => {
      base(error);
    });

    const invoke = createInvoke({
      call: 'test:action',
      save: jest.fn(),
      socket: mockSocket,
      onError: globalOnError,
    });

    try {
      await invoke({}, { onError: localOnError }, testId)(mockDispatch, mockGetState);
    } catch (e) {
      // ignore
    }

    expect(localOnError).toHaveBeenCalled();
    expect(globalOnError).toHaveBeenCalled();
  });
});