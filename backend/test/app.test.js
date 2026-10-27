import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('root explains that this server provides the API', async () => {
  const response = await fetch(`${baseUrl}/`, { headers: { Connection: 'close' } });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.name, 'EventPilot API');
  assert.equal(data.frontend, 'http://localhost:5173');
  assert.equal(data.health, '/api/health');
});

test('health reports database readiness instead of a false success', async () => {
  const response = await fetch(`${baseUrl}/api/health`, { headers: { Connection: 'close' } });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.status, 'error');
  assert.equal(data.database, 'disconnected');
});

test('write requests reject untrusted browser origins', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', Connection: 'close' },
  });

  assert.equal(response.status, 403);
});

test('local frontend writes are allowed with security headers', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Origin: 'http://localhost:5173', Connection: 'close' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('malformed JSON returns a client error', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:5173',
      'Content-Type': 'application/json',
      Connection: 'close',
    },
    body: '{',
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.message, 'Invalid JSON in request body.');
});

test('Vercel deployment origins are permitted by CORS', async () => {
  const response = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Origin: 'https://eventpilot-frontend.vercel.app', Connection: 'close' },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://eventpilot-frontend.vercel.app');
});

