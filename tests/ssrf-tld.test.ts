import { describe, it, expect } from 'vitest'
import {
  isPrivateOrLoopbackHost,
  getDomainBaseName
} from '../apps/desktop/src/main/utils/cacheProtocol'

describe('SSRF and Private Network Host Protection', () => {
  it('identifies localhost and loopback IPv4/IPv6', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true)
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('127.0.1.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('::1')).toBe(true)
    expect(isPrivateOrLoopbackHost('ip6-localhost')).toBe(true)
    expect(isPrivateOrLoopbackHost('ip6-loopback')).toBe(true)
  })

  it('blocks RFC1918 private IPv4 ranges', () => {
    // 10.0.0.0/8
    expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('10.255.255.254')).toBe(true)

    // 172.16.0.0/12
    expect(isPrivateOrLoopbackHost('172.16.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('172.31.255.255')).toBe(true)
    expect(isPrivateOrLoopbackHost('172.32.0.1')).toBe(false) // Public

    // 192.168.0.0/16
    expect(isPrivateOrLoopbackHost('192.168.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('192.168.1.100')).toBe(true)

    // Link-local 169.254.0.0/16
    expect(isPrivateOrLoopbackHost('169.254.169.254')).toBe(true)

    // CGNAT 100.64.0.0/10
    expect(isPrivateOrLoopbackHost('100.64.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('100.127.255.255')).toBe(true)
    expect(isPrivateOrLoopbackHost('100.128.0.1')).toBe(false) // Public
  })

  it('blocks IPv6 private and ULA addresses', () => {
    expect(isPrivateOrLoopbackHost('fc00::1')).toBe(true)
    expect(isPrivateOrLoopbackHost('fd12:3456:789a::1')).toBe(true)
    expect(isPrivateOrLoopbackHost('fe80::1')).toBe(true)
    expect(isPrivateOrLoopbackHost('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('::ffff:192.168.1.1')).toBe(true)
    expect(isPrivateOrLoopbackHost('::ffff:8.8.8.8')).toBe(false)
  })

  it('blocks DNS rebinding and internal suffixes', () => {
    expect(isPrivateOrLoopbackHost('router.local')).toBe(true)
    expect(isPrivateOrLoopbackHost('server.internal')).toBe(true)
    expect(isPrivateOrLoopbackHost('gateway.lan')).toBe(true)
    expect(isPrivateOrLoopbackHost('127.0.0.1.nip.io')).toBe(true)
    expect(isPrivateOrLoopbackHost('app.sslip.io')).toBe(true)
    expect(isPrivateOrLoopbackHost('test.localtest.me')).toBe(true)
  })

  it('allows safe public hostnames and public IPs', () => {
    expect(isPrivateOrLoopbackHost('google.com')).toBe(false)
    expect(isPrivateOrLoopbackHost('cloudflare.com')).toBe(false)
    expect(isPrivateOrLoopbackHost('8.8.8.8')).toBe(false)
    expect(isPrivateOrLoopbackHost('1.1.1.1')).toBe(false)
    expect(isPrivateOrLoopbackHost('vidmoly.to')).toBe(false)
  })
})

describe('Domain Base Name & Multi-Part TLD Parser', () => {
  it('extracts base names from standard domains', () => {
    expect(getDomainBaseName('example.com')).toBe('example')
    expect(getDomainBaseName('sub.example.com')).toBe('example')
    expect(getDomainBaseName('my-anime.org')).toBe('myanime')
    expect(getDomainBaseName('vidmoly.to')).toBe('vidmoly')
  })

  it('handles multi-part second-level TLDs correctly', () => {
    expect(getDomainBaseName('stream.site.co.uk')).toBe('site')
    expect(getDomainBaseName('anime.com.br')).toBe('anime')
    expect(getDomainBaseName('portal.gov.uk')).toBe('portal')
    expect(getDomainBaseName('cdn.media.org.za')).toBe('media')
  })

  it('handles edge cases gracefully', () => {
    expect(getDomainBaseName('')).toBe('')
    expect(getDomainBaseName('localhost')).toBe('')
    expect(getDomainBaseName('.')).toBe('')
  })
})
