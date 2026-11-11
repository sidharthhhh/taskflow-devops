const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT) || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'taskflow-dev-secret-change-in-prod';
const ADMIN_DB = process.env.PGADMIN_DB || 'postgres';

const app = express();
app.use(express.json());

// In-memory fallback so CI smoke tests and standalone local runs work without PostgreSQL
const memoryUsers = new Map();
let pgPool = null;
let pgReady = false;
let pgTargetDb = 'memory';
let retryTimer = null;

function isValidIdentifier(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function resolveDbConfigs() {
  if (process.env.DATABASE_URL) {
    const parsed = new URL(process.env.DATABASE_URL);
    const dbName = parsed.pathname.replace(/^\//, '') || 'authdb';
    const adminUrl = new URL(parsed.toString());
    adminUrl.pathname = `/${ADMIN_DB}`;
    return {
      targetDb: dbName,
      targetConfig: { connectionString: parsed.toString() },
      adminConfig: { connectionString: adminUrl.toString() },
    };
  }

  if (process.env.PGHOST) {
    const dbName = process.env.PGDATABASE || 'authdb';
    const base = {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'taskflow',
      password: process.env.PGPASSWORD || '',
    };
    return {
      targetDb: dbName,
      targetConfig: { ...base, database: dbName },
      adminConfig: { ...base, database: ADMIN_DB },
    };
  }

  return null;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = stored.split(':');
  const keyBuf = Buffer.from(key, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuf, derived);
}

async function getUser(email) {
  const normalized = email.trim().toLowerCase();
  if (pgPool && pgReady) {
    const { rows } = await pgPool.query(
      'SELECT email, name, role, password_hash, created_at FROM auth_users WHERE email = $1 LIMIT 1',
      [normalized]
    );
    if (rows.length > 0) {
      const row = rows[0];
      return {
        email: row.email,
        name: row.name,
        role: row.role,
        passwordHash: row.password_hash,
        createdAt: new Date(row.created_at).toISOString(),
      };
    }
    return null;
  }
  return memoryUsers.get(normalized) || null;
}

async function saveUser(user) {
  const normalized = user.email.trim().toLowerCase();
  memoryUsers.set(normalized, user);
  if (pgPool && pgReady) {
    await pgPool.query(
      `INSERT INTO auth_users (email, name, role, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      [normalized, user.name, user.role, user.passwordHash, user.createdAt]
    );
  }
}

async function seedDemoUser() {
  const existing = await getUser('admin@taskflow.dev');
  if (existing) return;
  await saveUser({
    email: 'admin@taskflow.dev',
    name: 'Sidharth DevOps',
    role: 'ADMIN',
    passwordHash: hashPassword('admin123'),
    createdAt: new Date().toISOString(),
  });
}

function scheduleDbInit() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    initDatabase().catch(() => {});
  }, 3000);
  if (typeof retryTimer.unref === 'function') retryTimer.unref();
}

async function initDatabase() {
  const configs = resolveDbConfigs();
  if (!configs) {
    await seedDemoUser();
    return;
  }

  if (!isValidIdentifier(configs.targetDb)) {
    throw new Error(`Unsafe PostgreSQL database name: ${configs.targetDb}`);
  }

  pgTargetDb = configs.targetDb;
  const adminPool = new Pool({ ...configs.adminConfig, max: 2, connectionTimeoutMillis: 4000 });
  try {
    const res = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [configs.targetDb]);
    if (res.rowCount === 0) {
      await adminPool.query(`CREATE DATABASE "${configs.targetDb}"`).catch((err) => {
        if (err.code !== '42P04') throw err;
      });
    }
  } finally {
    await adminPool.end().catch(() => {});
  }

  if (pgPool) {
    await pgPool.end().catch(() => {});
  }

  pgPool = new Pool({ ...configs.targetConfig, max: 5, connectionTimeoutMillis: 4000 });
  pgPool.on('error', () => {
    pgReady = false;
    scheduleDbInit();
  });

  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      email VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'USER',
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  pgReady = true;
  console.log(`auth-service connected to PostgreSQL database "${pgTargetDb}"`);
  await seedDemoUser();
}

function signToken(user) {
  return jwt.sign(
    { sub: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Seed memory fallback immediately, then connect/seed PostgreSQL when configured
seedDemoUser().catch(() => {});
initDatabase().catch((err) => {
  console.warn(`auth-service PostgreSQL init deferred (${err.message}); using memory fallback until reachable`);
  scheduleDbInit();
});

app.get('/health', async (_req, res) => {
  if (pgPool && pgReady) {
    try {
      await pgPool.query('SELECT 1');
    } catch {
      pgReady = false;
      scheduleDbInit();
    }
  }
  res.json({
    status: 'UP',
    service: 'auth-service',
    language: 'Node.js',
    database: pgReady ? 'CONNECTED' : 'MEMORY_FALLBACK',
    dbName: pgReady ? pgTargetDb : 'memory',
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || password.length < 4) {
      return res.status(400).json({ error: 'Valid email and password (min 4 chars) required' });
    }
    const existing = await getUser(email);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const user = {
      email: email.trim().toLowerCase(),
      name: (name || email.split('@')[0]).trim(),
      role: 'USER',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    await saveUser(user);
    const token = signToken(user);
    return res.status(201).json({
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await getUser(email);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = signToken(user);
    return res.json({
      token,
      user: { email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing Bearer token' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ user: { email: decoded.sub, name: decoded.name, role: decoded.role } });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const token = req.body?.token || '';
  if (!token) return res.status(400).json({ valid: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.json({ valid: true, user: { email: decoded.sub, name: decoded.name, role: decoded.role } });
  } catch {
    return res.status(401).json({ valid: false });
  }
});

const server = app.listen(PORT, () => {
  console.log(`auth-service listening on port ${PORT}`);
});

const shutdown = () => {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  server.close(async () => {
    if (pgPool) await pgPool.end().catch(() => {});
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
