import { describe, expect, it } from 'vitest'
import { chromeIntentUrl, isInAppBrowser, lineExternalUrl } from './inapp'

describe('in-app browser helpers', () => {
  it('detects Line / Facebook webviews but not Chrome', () => {
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36 Line/14.9.0')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit/605 Mobile/15E148 [FBAN/FBIOS;FBAV/450]')).toBe(true)
    expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36')).toBe(false)
  })
  it('builds external-browser links and keeps the route hash for Line', () => {
    expect(lineExternalUrl('https://x.github.io/church-accounting/#/join?t=abc')).toBe('https://x.github.io/church-accounting/?openExternalBrowser=1#/join?t=abc')
    expect(chromeIntentUrl('https://x.github.io/church-accounting/')).toContain('intent://x.github.io/church-accounting/#Intent;scheme=https;package=com.android.chrome')
  })
})
