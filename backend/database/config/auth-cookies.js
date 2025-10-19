const isProd = process.env.NODE_ENV === 'production'

const base = isProd
  ? { httpOnly: true, secure: true,  sameSite: 'none', path: '/' }
  : { httpOnly: true, secure: false, sameSite: 'lax',  path: '/' }

export function setAuthCookies(res, session) {
  const accessExpires = session?.expires_at
    ? new Date(session.expires_at * 1000)
    : new Date(Date.now() + 60 * 60 * 1000)

  res.cookie('sb_at', session.access_token, {
    ...base,
    expires: accessExpires,
  })

  res.cookie('sb_rt', session.refresh_token, {
    ...base,
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  })
}

export function clearAuthCookies(res) {
  res.clearCookie('sb_at', base)
  res.clearCookie('sb_rt', base)
}