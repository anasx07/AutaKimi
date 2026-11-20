export type ReadingMode =
  | 'paged-ltr'
  | 'paged-rtl'
  | 'paged-double-ltr'
  | 'paged-double-rtl'
  | 'paged-vertical'
  | 'continuous-ltr'
  | 'continuous-rtl'
  | 'continuous-vertical'
  | 'webtoon'

export interface ReaderShortcuts {
  pause: string
  toggle: string
  boost: string
  slow: string
  reverse: string
}
