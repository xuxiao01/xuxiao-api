const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('dotenv');
const { serializeEnvironment } = require('./env.cjs');
for (const secret of [
  'plain-test-secret',
  'test"quoted"value',
  "test'single'value",
  'test`tick`value',
  'test\\nbackslash',
  'test # hash value',
  'line\nline',
  'all\'"`quotes',
]) {
  test('environment serialization preserves a synthetic secret', () => {
    const values = {
      JWT_SECRET: secret,
      DATABASE_URL: 'postgresql://example.invalid/test',
      PORT: '3301',
    };
    assert.deepEqual(parse(serializeEnvironment(values, parse)), values);
  });
}
test('unsafe values fail closed without exposing the secret', () => {
  assert.throws(
    () => serializeEnvironment({ JWT_SECRET: 'bad\'"`#value' }, parse),
    /cannot be represented losslessly: JWT_SECRET/,
  );
});
