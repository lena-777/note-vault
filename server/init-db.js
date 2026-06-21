const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: '9.135.133.21',
  port: 3306,
  user: 'root',
  password: 'tegroot1',
  multipleStatements: true,
};

const SQL = `
CREATE DATABASE IF NOT EXISTS note_vault CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE note_vault;

CREATE TABLE IF NOT EXISTS goals (
  id VARCHAR(32) PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS subtopics (
  id VARCHAR(32) PRIMARY KEY,
  goal_id VARCHAR(32) NOT NULL,
  title VARCHAR(500) NOT NULL,
  \`order\` INT DEFAULT 0,
  created_at BIGINT NOT NULL,
  INDEX idx_goal_id (goal_id)
);

CREATE TABLE IF NOT EXISTS sources (
  id VARCHAR(32) PRIMARY KEY,
  goal_id VARCHAR(32),
  title VARCHAR(500) NOT NULL,
  url TEXT,
  status VARCHAR(20) DEFAULT 'unread',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_goal_id (goal_id)
);

CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(32) PRIMARY KEY,
  subtopic_id VARCHAR(32) NOT NULL,
  content TEXT NOT NULL,
  quote TEXT,
  source_id VARCHAR(32),
  tags JSON,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  INDEX idx_subtopic_id (subtopic_id)
);

CREATE TABLE IF NOT EXISTS note_relations (
  id VARCHAR(32) PRIMARY KEY,
  from_id VARCHAR(32) NOT NULL,
  to_id VARCHAR(32) NOT NULL,
  type VARCHAR(20) NOT NULL,
  created_at BIGINT NOT NULL,
  INDEX idx_from_id (from_id),
  INDEX idx_to_id (to_id)
);
`;

(async () => {
  const conn = await mysql.createConnection(DB_CONFIG);
  await conn.query(SQL);
  console.log('✅ 数据库 note_vault 及所有表初始化完成');
  await conn.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
