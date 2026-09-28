function requireGuest(req, res, next) {
  if (req.session.user) return res.redirect('/dashboard');
  next();
}

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.flash = { type: 'error', message: 'Vui lòng đăng nhập để tiếp tục.' };
    return res.redirect('/login');
  }
  next();
}

module.exports = { requireGuest, requireAuth };
