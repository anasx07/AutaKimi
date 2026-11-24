import { describe, it, expect } from 'vitest'
import { getPagedNavigationAction } from '../apps/desktop/src/renderer/src/widgets/reader/hooks/useKeyboardControls'
import { calculateZoom } from '../apps/desktop/src/renderer/src/widgets/reader/hooks/useZoom'

describe('Paged Reader Keyboard Navigation Actions', () => {
  describe('Paged RTL & Double RTL', () => {
    const modes = ['paged-rtl', 'paged-double-rtl']

    for (const mode of modes) {
      it(`turns forward (next) on ArrowLeft, KeyA, PageDown, and Space in ${mode}`, () => {
        expect(getPagedNavigationAction(mode, { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: 'a', code: 'KeyA' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: 'PageDown', code: 'PageDown' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: ' ', code: 'Space', shiftKey: false })).toBe('next')
      })

      it(`turns backward (prev) on ArrowRight, KeyD, PageUp, and Shift+Space in ${mode}`, () => {
        expect(getPagedNavigationAction(mode, { key: 'ArrowRight', code: 'ArrowRight' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: 'd', code: 'KeyD' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: 'PageUp', code: 'PageUp' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: ' ', code: 'Space', shiftKey: true })).toBe('prev')
      })
    }
  })

  describe('Paged LTR & Double LTR', () => {
    const modes = ['paged-ltr', 'paged-double-ltr']

    for (const mode of modes) {
      it(`turns forward (next) on ArrowRight, KeyD, PageDown, and Space in ${mode}`, () => {
        expect(getPagedNavigationAction(mode, { key: 'ArrowRight', code: 'ArrowRight' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: 'd', code: 'KeyD' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: 'PageDown', code: 'PageDown' })).toBe('next')
        expect(getPagedNavigationAction(mode, { key: ' ', code: 'Space', shiftKey: false })).toBe('next')
      })

      it(`turns backward (prev) on ArrowLeft, KeyA, PageUp, and Shift+Space in ${mode}`, () => {
        expect(getPagedNavigationAction(mode, { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: 'a', code: 'KeyA' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: 'PageUp', code: 'PageUp' })).toBe('prev')
        expect(getPagedNavigationAction(mode, { key: ' ', code: 'Space', shiftKey: true })).toBe('prev')
      })
    }
  })

  describe('Paged Vertical', () => {
    it('turns forward (next) on ArrowDown, KeyS, ArrowRight, PageDown, Space', () => {
      expect(getPagedNavigationAction('paged-vertical', { key: 'ArrowDown', code: 'ArrowDown' })).toBe('next')
      expect(getPagedNavigationAction('paged-vertical', { key: 's', code: 'KeyS' })).toBe('next')
      expect(getPagedNavigationAction('paged-vertical', { key: 'ArrowRight', code: 'ArrowRight' })).toBe('next')
      expect(getPagedNavigationAction('paged-vertical', { key: 'PageDown', code: 'PageDown' })).toBe('next')
    })

    it('turns backward (prev) on ArrowUp, KeyW, ArrowLeft, PageUp, Shift+Space', () => {
      expect(getPagedNavigationAction('paged-vertical', { key: 'ArrowUp', code: 'ArrowUp' })).toBe('prev')
      expect(getPagedNavigationAction('paged-vertical', { key: 'w', code: 'KeyW' })).toBe('prev')
      expect(getPagedNavigationAction('paged-vertical', { key: 'ArrowLeft', code: 'ArrowLeft' })).toBe('prev')
      expect(getPagedNavigationAction('paged-vertical', { key: 'PageUp', code: 'PageUp' })).toBe('prev')
    })
  })

  describe('Continuous & Webtoon Modes', () => {
    it('returns null for non-paged modes so auto-scroll shortcuts remain unaffected', () => {
      expect(getPagedNavigationAction('webtoon', { key: 'ArrowRight', code: 'ArrowRight' })).toBeNull()
      expect(getPagedNavigationAction('continuous-vertical', { key: 'ArrowLeft', code: 'ArrowLeft' })).toBeNull()
      expect(getPagedNavigationAction('continuous-ltr', { key: 'ArrowDown', code: 'ArrowDown' })).toBeNull()
      expect(getPagedNavigationAction('continuous-rtl', { key: 'ArrowUp', code: 'ArrowUp' })).toBeNull()
      expect(getPagedNavigationAction(undefined, { key: 'ArrowRight', code: 'ArrowRight' })).toBeNull()
    })
  })
})

describe('Zoom Calculations', () => {
  it('increments and decrements zoom level cleanly with step', () => {
    expect(calculateZoom(1, 0.1)).toBe(1.1)
    expect(calculateZoom(1.1, 0.1)).toBe(1.2)
    expect(calculateZoom(1, -0.1)).toBe(0.9)
    expect(calculateZoom(0.9, -0.1)).toBe(0.8)
  })

  it('clamps zoom within minZoom and maxZoom', () => {
    expect(calculateZoom(0.5, -0.1, 0.5, 4)).toBe(0.5)
    expect(calculateZoom(4.0, 0.2, 0.5, 4)).toBe(4.0)
  })
})
