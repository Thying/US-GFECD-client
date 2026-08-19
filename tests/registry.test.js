import { clearUnsubscribe, decrement, getUnsubscribe, increment, setUnsubscribe } from '../src/store/registry';

describe('registry', () => {
  const testId = { id: 123 };

  it('should increment and decrement counters', () => {
    increment('test', testId);
    increment('test', testId);
    expect(decrement('test', testId)).toBe(false); // не последний
    expect(decrement('test', testId)).toBe(true); // последний
  });

  it('should set and get unsubscribe', () => {
    const unsub = jest.fn();
    setUnsubscribe('test', testId, unsub);
    expect(getUnsubscribe('test', testId)).toBe(unsub);

    clearUnsubscribe('test', testId);
    expect(getUnsubscribe('test', testId)).toBeUndefined();
  });

  it('should use default ID when not provided', () => {
    const unsub = jest.fn();
    setUnsubscribe('test', undefined, unsub);
    expect(getUnsubscribe('test', undefined)).toBe(unsub);

    clearUnsubscribe('test', undefined);
    expect(getUnsubscribe('test', undefined)).toBeUndefined();
  });
});