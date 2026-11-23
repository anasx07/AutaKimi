import { describe, it, expect, beforeEach } from 'vitest'
import {
  getRegistrableDomain,
  StreamProxyService
} from '../apps/desktop/src/main/services/stream-proxy.service'

describe('Stream Proxy Registrable Domain Extractor', () => {
  it('extracts registrable domain from standard hosts', () => {
    expect(getRegistrableDomain('example.com')).toBe('example.com')
    expect(getRegistrableDomain('video.example.com')).toBe('example.com')
    expect(getRegistrableDomain('sub.media.cdn.example.org')).toBe('example.org')
    expect(getRegistrableDomain('vidmoly.to')).toBe('vidmoly.to')
  })

  it('handles country-code second-level domains (ccSLD)', () => {
    expect(getRegistrableDomain('stream.video.co.uk')).toBe('video.co.uk')
    expect(getRegistrableDomain('cdn.manga.com.br')).toBe('manga.com.br')
    expect(getRegistrableDomain('gov.portal.gov.uk')).toBe('portal.gov.uk')
    expect(getRegistrableDomain('school.edu.au')).toBe('school.edu.au')
  })

  it('returns null for localhost, IP addresses, and invalid hostnames', () => {
    expect(getRegistrableDomain('localhost')).toBeNull()
    expect(getRegistrableDomain('127.0.0.1')).toBeNull()
    expect(getRegistrableDomain('192.168.1.50')).toBeNull()
    expect(getRegistrableDomain('[::1]')).toBeNull()
    expect(getRegistrableDomain('host:8080')).toBeNull()
    expect(getRegistrableDomain('')).toBeNull()
    expect(getRegistrableDomain('com')).toBeNull()
  })
})

describe('StreamProxyService Header Rules', () => {
  let proxyService: StreamProxyService

  beforeEach(() => {
    proxyService = new StreamProxyService()
  })

  it('applies registered stream headers by exact origin and root domain', () => {
    proxyService.setStreamHeaders('https://stream.vidmoly.to/video.m3u8', {
      Referer: 'https://vidmoly.to/',
      'User-Agent': 'AutaKimi-Player'
    })

    // Request to the exact URL or another sub-path on the root domain
    const initialHeaders: Record<string, string | string[]> = {
      Accept: '*/*'
    }

    const applied = proxyService.applyRequestHeaders(
      'https://stream.vidmoly.to/segment_1.ts',
      initialHeaders
    )

    expect(applied['Referer']).toBe('https://vidmoly.to/')
    expect(applied['User-Agent']).toBe('AutaKimi-Player')
    expect(applied['Accept']).toBe('*/*')
  })

  it('adds CORS headers in applyResponseHeaders for registered stream targets', () => {
    proxyService.setStreamHeaders('https://stream.vidmoly.to/video.m3u8', {
      Referer: 'https://vidmoly.to/'
    })

    const responseHeaders: Record<string, string[]> = {
      'content-type': ['application/vnd.apple.mpegurl']
    }

    const modified = proxyService.applyResponseHeaders(
      'https://stream.vidmoly.to/video.m3u8',
      responseHeaders
    )

    expect(modified['Access-Control-Allow-Origin']).toEqual(['*'])
    expect(modified['Access-Control-Allow-Methods']).toEqual(['GET, HEAD, OPTIONS, POST'])
    expect(modified['Access-Control-Allow-Headers']).toEqual(['*'])
  })
})
