const isProd = process.env.NODE_ENV === 'production'

export function setAuthCookies(res, session) {
  // session.expires_at is epoch seconds (number); convert to Date for cookie expires
  const accessExpires = session?.expires_at
    ? new Date(session.expires_at * 1000)
    : new Date(Date.now() + 60 * 60 * 1000)

  // ACCESS TOKEN
  res.cookie('sb_at', session.access_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    expires: accessExpires,
    path: '/',
  })

  res.cookie('sb_rt', session.refresh_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
    path: '/',
  })
}

export function clearAuthCookies(res) {
  res.clearCookie('sb_at', { path: '/' })
  res.clearCookie('sb_rt', { path: '/' })
}