require('dotenv').config({ quiet: true });

const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { sql, getPool, ensureSchema } = require('./db');
const { requireGuest, requireAuth } = require('./middleware/auth');
const { csrfToken, verifyCsrf } = require('./middleware/csrf');
const SqlServerSessionStore = require('./session-store');

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  store: new SqlServerSessionStore(),
  secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.get('/healthz', (req, res) => res.status(200).json({ status: 'ok' }));

app.use(csrfToken);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

function validateCredentials(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!/^[a-z0-9_.]{3,30}$/.test(cleanUsername)) {
    return { error: 'Tên đăng nhập gồm 3–30 ký tự: chữ thường, số, dấu chấm hoặc gạch dưới.' };
  }
  if (cleanPassword.length < 8 || cleanPassword.length > 72) {
    return { error: 'Mật khẩu phải có từ 8 đến 72 ký tự.' };
  }
  return { username: cleanUsername, password: cleanPassword };
}

app.get('/', (req, res) => res.render('home', { title: 'Momentum — Mỗi ngày tốt hơn 1%' }));

app.get('/register', requireGuest, (req, res) => {
  res.render('register', { title: 'Tạo tài khoản', error: null, form: {} });
});

app.post('/register', authLimiter, requireGuest, verifyCsrf, async (req, res, next) => {
  const credentials = validateCredentials(req.body.username, req.body.password);
  const form = { username: String(req.body.username || '').trim() };

  if (credentials.error) {
    return res.status(400).render('register', { title: 'Tạo tài khoản', error: credentials.error, form });
  }
  if (req.body.password !== req.body.confirmPassword) {
    return res.status(400).render('register', { title: 'Tạo tài khoản', error: 'Mật khẩu xác nhận chưa khớp.', form });
  }

  try {
    const pool = await getPool();
    const exists = await pool.request()
      .input('username', sql.NVarChar(50), credentials.username)
      .query('SELECT TOP 1 Id FROM dbo.Users WHERE Username = @username');

    if (exists.recordset.length) {
      return res.status(409).render('register', { title: 'Tạo tài khoản', error: 'Tên đăng nhập này đã được sử dụng.', form });
    }

    const passwordHash = await bcrypt.hash(credentials.password, 12);
    const result = await pool.request()
      .input('username', sql.NVarChar(50), credentials.username)
      .input('passwordHash', sql.NVarChar(255), passwordHash)
      .query(`
        INSERT INTO dbo.Users (Username, PasswordHash)
        OUTPUT INSERTED.Id, INSERTED.Username
        VALUES (@username, @passwordHash)
      `);

    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);
      req.session.user = result.recordset[0];
      req.session.flash = { type: 'success', message: 'Chào mừng bạn đến với Momentum!' };
      res.redirect('/dashboard');
    });
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return res.status(409).render('register', {
        title: 'Tạo tài khoản',
        error: 'Tên đăng nhập này đã được sử dụng.',
        form
      });
    }
    next(error);
  }
});

app.get('/login', requireGuest, (req, res) => {
  res.render('login', { title: 'Đăng nhập', error: null, form: {} });
});

app.post('/login', authLimiter, requireGuest, verifyCsrf, async (req, res, next) => {
  const credentials = validateCredentials(req.body.username, req.body.password);
  const form = { username: String(req.body.username || '').trim() };
  const invalidMessage = 'Tên đăng nhập hoặc mật khẩu không chính xác.';

  if (credentials.error) {
    return res.status(401).render('login', { title: 'Đăng nhập', error: invalidMessage, form });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('username', sql.NVarChar(50), credentials.username)
      .query('SELECT TOP 1 Id, Username, PasswordHash FROM dbo.Users WHERE Username = @username');
    const account = result.recordset[0];
    const isValid = account && await bcrypt.compare(credentials.password, account.PasswordHash);

    if (!isValid) {
      return res.status(401).render('login', { title: 'Đăng nhập', error: invalidMessage, form });
    }

    req.session.regenerate((sessionError) => {
      if (sessionError) return next(sessionError);
      req.session.user = { Id: account.Id, Username: account.Username };
      req.session.cookie.maxAge = req.body.remember
        ? 1000 * 60 * 60 * 24 * 30
        : 1000 * 60 * 60 * 8;
      res.redirect('/dashboard');
    });
  } catch (error) {
    next(error);
  }
});

app.get('/dashboard', requireAuth, (req, res) => {
  const habits = [
    { icon: 'water', name: 'Uống đủ nước', detail: '6 / 8 ly', progress: 75, done: false },
    { icon: 'book', name: 'Đọc sách', detail: '20 phút', progress: 100, done: true },
    { icon: 'walk', name: 'Đi bộ', detail: '4.200 / 6.000 bước', progress: 70, done: false }
  ];
  const displayDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: 'numeric', month: 'long'
  }).format(new Date());
  res.render('dashboard', { title: 'Hôm nay của bạn', habits, displayDate });
});

app.post('/logout', requireAuth, verifyCsrf, (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

app.use((req, res) => {
  res.status(404).render('error', { title: 'Không tìm thấy trang', status: 404, message: 'Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  const databaseError = ['ESOCKET', 'ELOGIN', 'ENOTOPEN', 'ETIMEOUT'].includes(error.code);
  res.status(500).render('error', {
    title: 'Đã có lỗi xảy ra',
    status: 500,
    message: databaseError
      ? 'Không thể kết nối tới MSSQL. Hãy kiểm tra lại cấu hình trong tệp .env.'
      : 'Momentum đang gặp một chút trục trặc. Vui lòng thử lại sau.'
  });
});

async function start() {
  try {
    await ensureSchema();
    app.listen(port, host, () => console.log(`Momentum đang chạy tại http://${host}:${port}`));
  } catch (error) {
    console.error('Không thể khởi động ứng dụng:', error.message);
    console.error('Hãy chạy "npm run db:init" và kiểm tra lại cấu hình .env.');
    process.exit(1);
  }
}

if (require.main === module) start();

module.exports = { app, validateCredentials };
