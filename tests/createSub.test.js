import { createSub } from '../src/store/factories/createSub';

describe('createSub with entity', () => {
  let mockSocket;
  let mockEntity;

  beforeEach(() => {
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    };

    // Создаём фиктивную entity с actions
    mockEntity = {
      actions: {
        deleteContest: jest.fn((data) => ({ type: 'DELETE', payload: data })),
        updateContest: jest.fn((data) => ({ type: 'UPDATE', payload: data })),
        clearContest: jest.fn(() => ({ type: 'CLEAR' })),
      },
    };
  });

  describe('global event (no room)', () => {
    it('should subscribe and unsubscribe without joining any room', () => {
      const handlers = {
        contestDeleted: 'deleteContest', // имя экшена из entity
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const unsubscribe = sub.subscribe(dispatch);

      expect(mockSocket.on).toHaveBeenCalledWith('contestDeleted', expect.any(Function));
      expect(mockSocket.emit).not.toHaveBeenCalledWith('join', expect.any(String));

      const handler = mockSocket.on.mock.calls[0][1];
      const data = { id: '123' };
      handler(data);

      // Проверяем, что dispatch вызван с экшеном, который вернул deleteContest
      expect(mockEntity.actions.deleteContest).toHaveBeenCalledWith(data);
      expect(dispatch).toHaveBeenCalledWith({ type: 'DELETE', payload: data });

      unsubscribe();
      expect(mockSocket.off).toHaveBeenCalledWith('contestDeleted', expect.any(Function));
      expect(mockSocket.emit).not.toHaveBeenCalledWith('leave', expect.any(String));
    });

    it('should accept function directly', () => {
      const saveFn = jest.fn((data) => ({ type: 'SAVE', payload: data }));
      const handlers = { event: saveFn };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      sub.subscribe(dispatch);
      const handler = mockSocket.on.mock.calls[0][1];
      handler({ id: 1 });

      expect(saveFn).toHaveBeenCalledWith({ id: 1 });
      expect(dispatch).toHaveBeenCalledWith({ type: 'SAVE', payload: { id: 1 } });
    });
  });

  describe('static room', () => {
    it('should join and leave a static room', () => {
      const handlers = {
        adminEvent: {
          room: 'admin',
          save: 'updateContest',
        },
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const unsubscribe = sub.subscribe(dispatch);

      expect(mockSocket.on).toHaveBeenCalledWith('adminEvent', expect.any(Function));
      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'admin');

      const handler = mockSocket.on.mock.calls[0][1];
      const data = { id: '123' };
      handler(data);

      expect(mockEntity.actions.updateContest).toHaveBeenCalledWith(data);

      unsubscribe();
      expect(mockSocket.off).toHaveBeenCalledWith('adminEvent', expect.any(Function));
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'admin');
    });
  });

  describe('room with single parameter {id}', () => {
    it('should substitute {id} with params.id', () => {
      const handlers = {
        userPageUpdated: {
          room: 'user{id}',
          save: 'updateContest',
        },
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const params = { id: '123' };
      const unsubscribe = sub.subscribe(dispatch, params);

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'user123');

      unsubscribe();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'user123');
    });

    it('should use empty string if parameter is missing', () => {
      const handlers = {
        userPageUpdated: {
          room: 'user{id}',
          save: 'updateContest',
        },
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const params = {};
      const unsubscribe = sub.subscribe(dispatch, params);

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'user');

      unsubscribe();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'user');
    });
  });

  describe('room with multiple parameters', () => {
    it('should substitute multiple placeholders', () => {
      const handlers = {
        teamEvent: {
          room: 'team{teamId}/user{userId}',
          save: 'updateContest',
        },
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const params = { teamId: '1', userId: '42' };
      const unsubscribe = sub.subscribe(dispatch, params);

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'team1/user42');

      unsubscribe();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'team1/user42');
    });

    it('should handle missing parameters by leaving placeholders', () => {
      const handlers = {
        teamEvent: {
          room: 'team{teamId}/user{userId}',
          save: 'updateContest',
        },
      };
      const sub = createSub(handlers, mockEntity, mockSocket);
      const dispatch = jest.fn();

      const params = { teamId: '1' };
      const unsubscribe = sub.subscribe(dispatch, params);

      expect(mockSocket.emit).toHaveBeenCalledWith('join', 'team1/user');

      unsubscribe();
      expect(mockSocket.emit).toHaveBeenCalledWith('leave', 'team1/user');
    });
  });

  describe('error handling', () => {
    it('should throw if action name not found', () => {
      const handlers = {
        event: 'nonExistentAction',
      };
      expect(() => createSub(handlers, mockEntity, mockSocket)).toThrow(/action "nonExistentAction" not found/);
    });

    it('should throw if entity is not provided', () => {
      expect(() => createSub({}, null, mockSocket)).toThrow(/second argument must be an entity/);
    });
  });
});