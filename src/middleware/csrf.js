const crypto = require('crypto');

function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function verifyCsrf(req, res, next) {
  const submitted = Buffer.from(String(req.body._csrf || ''));
  const expected = Buffer.from(String(req.session.csrfToken || ''));

  if (submitted.length !== expected.length || !crypto.timingSafeEqual(submitted, expected)) {
    return res.status(403).render('error', {
      title: 'Yêu cầu không hợp lệ',
      status: 403,
      message: 'Phiên làm việc đã hết hạn. Vui lòng tải lại trang và thử lại.'
    });
  }
  next();
}

module.exports = { csrfToken, verifyCsrf };
