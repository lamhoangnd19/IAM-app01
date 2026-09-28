require('dotenv').config({ quiet: true });

const sql = require('mssql');
const { databaseName, baseConfig } = require('../src/db');

function quoteIdentifier(value) {
  return `[${String(value).replace(/]/g, ']]')}]`;
}

async function init() {
  if (!process.env.DB_PASSWORD) {
    throw new Error('Thiếu DB_PASSWORD trong tệp .env');
  }

  const master = await new sql.ConnectionPool(baseConfig('master')).connect();
  const safeName = quoteIdentifier(databaseName);
  const nameLiteral = databaseName.replace(/'/g, "''");
  await master.request().query(`IF DB_ID(N'${nameLiteral}') IS NULL CREATE DATABASE ${safeName}`);
  await master.close();

  const database = await new sql.ConnectionPool(baseConfig()).connect();
  await database.request().query(`
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
  await database.close();
  console.log(`Đã khởi tạo database ${databaseName} và bảng Users.`);
}

init().catch((error) => {
  console.error('Khởi tạo database thất bại:', error.message);
  process.exit(1);
});
