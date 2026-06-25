import { clearUnsubscribe, decrement, getUnsubscribe, increment, setUnsubscribe } from '../src/store/registry'

describe('registry', () => {
  it('should increment and decrement counters', () => {
    increment('test')
    increment('test')
    expect(decrement('test')).toBe(false) // не последний
    expect(decrement('test')).toBe(true) // последний
  })

  it('should set and get unsubscribe', () => {
    const unsub = jest.fn()
    setUnsubscribe('test', unsub)
    expect(getUnsubscribe('test')).toBe(unsub)

    clearUnsubscribe('test')
    expect(getUnsubscribe('test')).toBeUndefined()
  })
})