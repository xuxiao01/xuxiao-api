'use strict';
// dotenv quoting is not JSON quoting: never add escapes to a shared secret.
function serializeEnvironment(values, parse) {
  const text =
    Object.entries(values)
      .map(([key, value]) => {
        if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string') {
          throw new Error('Invalid environment field');
        }
        const candidates = ["'", '"', '`']
          .filter((quote) => !value.includes(quote))
          .map((quote) => quote + value + quote);
        candidates.push(value);
        const encoded = candidates.find(
          (candidate) => parse('VALUE=' + candidate + '\n').VALUE === value,
        );
        if (encoded === undefined)
          throw new Error('Environment value cannot be represented losslessly: ' + key);
        return key + '=' + encoded;
      })
      .join('\n') + '\n';
  const decoded = parse(text);
  if (Object.keys(values).some((key) => decoded[key] !== values[key])) {
    throw new Error('Environment roundtrip verification failed');
  }
  return text;
}
module.exports = { serializeEnvironment };
