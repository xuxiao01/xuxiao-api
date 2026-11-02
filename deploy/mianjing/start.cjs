'use strict';
require('dotenv').config({ quiet: true });
process.env.APP_MODULES = 'mianjing';
const port = Number(process.env.PORT);
if (port !== 3301) throw new Error('Isolated mianjing service requires PORT=3301');
const app = require('../../dist/app').default;
app.listen(port, '127.0.0.1', () => console.log('mianjing-api listening on 127.0.0.1:3301'));
