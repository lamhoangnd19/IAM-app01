const session = require('express-session');
const { sql, getPool } = require('./db');

class SqlServerSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.ttl = options.ttl || 1000 * 60 * 60 * 8;
    this.cleanupTimer = setInterval(() => this.cleanup(), 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async get(sid, callback) {
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('sid', sql.NVarChar(128), sid)
        .query(`
          SELECT SessionData
          FROM dbo.Sessions
          WHERE SessionId = @sid AND ExpiresAt > SYSUTCDATETIME()
        `);
      callback(null, result.recordset[0] ? JSON.parse(result.recordset[0].SessionData) : null);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, value, callback = () => {}) {
    try {
      const pool = await getPool();
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires)
        : new Date(Date.now() + this.ttl);
      await pool.request()
        .input('sid', sql.NVarChar(128), sid)
        .input('data', sql.NVarChar(sql.MAX), JSON.stringify(value))
        .input('expiresAt', sql.DateTime2, expiresAt)
        .query(`
          MERGE dbo.Sessions WITH (HOLDLOCK) AS target
          USING (SELECT @sid AS SessionId) AS source
          ON target.SessionId = source.SessionId
          WHEN MATCHED THEN
            UPDATE SET SessionData = @data, ExpiresAt = @expiresAt
          WHEN NOT MATCHED THEN
            INSERT (SessionId, SessionData, ExpiresAt)
            VALUES (@sid, @data, @expiresAt);
        `);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback = () => {}) {
    try {
      const pool = await getPool();
      await pool.request()
        .input('sid', sql.NVarChar(128), sid)
        .query('DELETE FROM dbo.Sessions WHERE SessionId = @sid');
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, value, callback = () => {}) {
    try {
      const pool = await getPool();
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires)
        : new Date(Date.now() + this.ttl);
      await pool.request()
        .input('sid', sql.NVarChar(128), sid)
        .input('expiresAt', sql.DateTime2, expiresAt)
        .query('UPDATE dbo.Sessions SET ExpiresAt = @expiresAt WHERE SessionId = @sid');
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async cleanup() {
    try {
      const pool = await getPool();
      await pool.request().query('DELETE FROM dbo.Sessions WHERE ExpiresAt <= SYSUTCDATETIME()');
    } catch (error) {
      console.error('Không thể dọn session hết hạn:', error.message);
    }
  }
}

module.exports = SqlServerSessionStore;
