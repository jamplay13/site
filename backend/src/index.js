import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://demo:demo@localhost:5432/cassino' });

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance BIGINT NOT NULL DEFAULT 0
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type TEXT,
    amount BIGINT,
    created_at TIMESTAMP DEFAULT now()
  );`);
  console.log('DB initialized');
}
init().catch(console.error);

function tokenFor(user) {
  return jwt.sign({ userId: user.id }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
}
async function getUserFromReq(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const token = auth.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
    const res = await pool.query('SELECT id, email FROM users WHERE id=$1', [payload.userId]);
    return res.rows[0] || null;
  } catch (e) { return null; }
}

app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({error:'invalid'});
  const hashed = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query('INSERT INTO users(email,password) VALUES($1,$2) RETURNING id,email', [email,hashed]);
    const user = r.rows[0];
    await pool.query('INSERT INTO wallets(user_id,balance) VALUES($1,$2)', [user.id, 1000]);
    return res.json({ ok:true, token: tokenFor(user) });
  } catch(e) {
    return res.status(400).json({ error: 'already_exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const r = await pool.query('SELECT id,email,password FROM users WHERE email=$1', [email]);
  const user = r.rows[0];
  if(!user) return res.status(400).json({ error:'invalid' });
  const match = await bcrypt.compare(password, user.password);
  if(!match) return res.status(400).json({ error:'invalid' });
  res.json({ ok:true, token: tokenFor(user) });
});

app.get('/api/me', async (req,res) => {
  const user = await getUserFromReq(req);
  if(!user) return res.status(401).json({ error:'unauth' });
  const wb = await pool.query('SELECT balance FROM wallets WHERE user_id=$1', [user.id]);
  res.json({ user, balance: wb.rows[0]?.balance ?? 0 });
});

app.post('/api/sandbox/deposit', async (req,res) => {
  const user = await getUserFromReq(req);
  if(!user) return res.status(401).json({ error:'unauth' });
  const amount = parseInt(req.body.amount || 0, 10);
  if(amount <= 0) return res.status(400).json({ error:'invalid_amount' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id=$2', [amount, user.id]);
    await client.query('INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)', [user.id,'deposit',amount]);
    await client.query('COMMIT');
    res.json({ ok:true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'db_error' });
  } finally {
    client.release();
  }
});

app.post('/api/bet', async (req,res) => {
  const user = await getUserFromReq(req);
  if(!user) return res.status(401).json({ error:'unauth' });
  const { stake, game } = req.body;
  const s = parseInt(stake || 0, 10);
  if(s <= 0) return res.status(400).json({ error:'invalid_stake' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const wq = await client.query('SELECT balance FROM wallets WHERE user_id=$1 FOR UPDATE', [user.id]);
    const bal = parseInt(wq.rows[0].balance || 0, 10);
    if(bal < s) { await client.query('ROLLBACK'); return res.status(400).json({ error:'insufficient' }); }
    await client.query('UPDATE wallets SET balance = balance - $1 WHERE user_id=$2', [s, user.id]);
    await client.query('INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)', [user.id,'bet',-s]);
    const r = Math.random();
    let payout = 0;
    if(game === 'coin') { if(r < 0.49) payout = s * 2; }
    else if(game === 'slot') { if(r < 0.05) payout = s * 10; else if(r < 0.20) payout = Math.floor(s * 2.5); }
    else { if(r < 0.33) payout = s * 2; }
    if(payout > 0) {
      await client.query('UPDATE wallets SET balance = balance + $1 WHERE user_id=$2', [payout, user.id]);
      await client.query('INSERT INTO transactions(user_id,type,amount) VALUES($1,$2,$3)', [user.id,'payout',payout]);
    }
    await client.query('COMMIT');
    res.json({ ok:true, payout });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error:'db_error' });
  } finally {
    client.release();
  }
});

const port = process.env.PORT || 4000;
app.listen(port, ()=>console.log('Backend running on', port));
