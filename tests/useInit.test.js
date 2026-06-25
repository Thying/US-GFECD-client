import { renderHook } from '@testing-library/react'
import { useDispatch } from 'react-redux'
import { useInit } from '../src/ui/hooks/useInit'

// Мокаем useDispatch
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}))

describe('useInit', () => {
  it('should call init on mount and clean on unmount', () => {
    const dispatch = jest.fn()
    useDispatch.mockReturnValue(dispatch)

    // Мокаем init и clean как функции, которые возвращают что-то
    const init = jest.fn(() => ({ type: 'INIT' }))
    const clean = jest.fn(() => ({ type: 'CLEAN' }))

    const { unmount } = renderHook(() => useInit(init, clean))

    // Проверяем, что dispatch вызван с результатом вызова init
    expect(dispatch).toHaveBeenCalledWith({ type: 'INIT' })
    expect(init).toHaveBeenCalled()

    unmount()
    expect(dispatch).toHaveBeenCalledWith({ type: 'CLEAN' })
    expect(clean).toHaveBeenCalled()
  })

  it('should not call clean if not provided', () => {
    const dispatch = jest.fn()
    useDispatch.mockReturnValue(dispatch)

    const init = jest.fn(() => ({ type: 'INIT' }))

    renderHook(() => useInit(init))

    expect(dispatch).toHaveBeenCalledWith({ type: 'INIT' })
    expect(init).toHaveBeenCalled()
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})