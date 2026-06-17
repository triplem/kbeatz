import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { logger } from './logger'

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  describe('structured output', () => {
    it('error emits structured JSON to console.error', () => {
      logger.error({ err: 'boom', albumId: 'a1' }, 'batch_save_failed')

      expect(console.error).toHaveBeenCalledTimes(1)
      const payload = JSON.parse(vi.mocked(console.error).mock.calls[0]![0] as string)
      expect(payload).toEqual({
        level: 'error',
        err: 'boom',
        albumId: 'a1',
        msg: 'batch_save_failed',
      })
    })

    it('warn emits structured JSON to console.warn', () => {
      logger.warn({ albumId: 'a2' }, 'cover_art_missing')

      expect(console.warn).toHaveBeenCalledTimes(1)
      expect(console.error).not.toHaveBeenCalled()
      const payload = JSON.parse(vi.mocked(console.warn).mock.calls[0]![0] as string)
      expect(payload).toEqual({
        level: 'warn',
        albumId: 'a2',
        msg: 'cover_art_missing',
      })
    })

    it('does not cross-write warn to console.error', () => {
      logger.error({ err: 'x' }, 'err_msg')
      expect(console.warn).not.toHaveBeenCalled()
    })
  })

  describe('observability sink', () => {
    it('is a no-op when VITE_LOG_SINK_URL is unset', () => {
      vi.stubEnv('VITE_LOG_SINK_URL', '')
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      logger.error({ err: 'boom' }, 'no_sink')
      logger.warn({}, 'no_sink_warn')

      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('POSTs the entry to the sink when VITE_LOG_SINK_URL is set', () => {
      vi.stubEnv('VITE_LOG_SINK_URL', 'https://sink.example/logs')
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      logger.error({ err: 'boom', albumId: 'a3' }, 'sink_error')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://sink.example/logs')
      expect(init.method).toBe('POST')
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
      const body = JSON.parse(init.body as string)
      expect(body).toEqual({
        level: 'error',
        err: 'boom',
        albumId: 'a3',
        msg: 'sink_error',
      })
    })

    it('also forwards warn entries to the sink when configured', () => {
      vi.stubEnv('VITE_LOG_SINK_URL', 'https://sink.example/logs')
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
      vi.stubGlobal('fetch', fetchMock)

      logger.warn({ albumId: 'a4' }, 'sink_warn')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string)
      expect(body.level).toBe('warn')
      expect(body.msg).toBe('sink_warn')
    })

    it('swallows a rejected sink promise without throwing', async () => {
      vi.stubEnv('VITE_LOG_SINK_URL', 'https://sink.example/logs')
      const rejection = Promise.reject(new Error('network down'))
      const fetchMock = vi.fn().mockReturnValue(rejection)
      vi.stubGlobal('fetch', fetchMock)

      expect(() => logger.error({ err: 'boom' }, 'sink_reject')).not.toThrow()
      // Console output still happens regardless of sink outcome.
      expect(console.error).toHaveBeenCalledTimes(1)
      // Allow the rejected promise to settle so the .catch handler runs and the
      // rejection does not surface as an unhandled rejection.
      await rejection.catch(() => undefined)
    })

    it('swallows a synchronous throw from fetch', () => {
      vi.stubEnv('VITE_LOG_SINK_URL', 'https://sink.example/logs')
      const fetchMock = vi.fn().mockImplementation(() => {
        throw new Error('sync boom')
      })
      vi.stubGlobal('fetch', fetchMock)

      expect(() => logger.warn({}, 'sink_sync_throw')).not.toThrow()
      expect(console.warn).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when fetch is unavailable even with a sink URL set', () => {
      vi.stubEnv('VITE_LOG_SINK_URL', 'https://sink.example/logs')
      vi.stubGlobal('fetch', undefined)

      expect(() => logger.error({ err: 'boom' }, 'no_fetch')).not.toThrow()
      expect(console.error).toHaveBeenCalledTimes(1)
    })
  })
})
