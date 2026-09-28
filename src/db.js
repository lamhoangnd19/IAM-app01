const sql = require('mssql');

const databaseName = process.env.DB_NAME || 'MomentumDB';

function baseConfig(database = databaseName) {
  return {
    server: process.env.DB_SERVER || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false'
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
}

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(baseConfig()).connect();
  }
  return poolPromise;
}

async function ensureSchema() {
  const pool = await getPool();
  await pool.request().query(`
    IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME()
      );
    END

    IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Sessions (
        SessionId NVARCHAR(128) NOT NULL PRIMARY KEY,
        SessionData NVARCHAR(MAX) NOT NULL,
        ExpiresAt DATETIME2 NOT NULL
      );
      CREATE INDEX IX_Sessions_ExpiresAt ON dbo.Sessions (ExpiresAt);
    END
  `);
}

module.exports = { sql, databaseName, baseConfig, getPool, ensureSchema };
