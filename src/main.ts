import 'dotenv/config';
import app from './app';
import { env } from './config/env';

const port = env.PORT;

app.listen(port, () => {
  console.log(`xuxiao-api running on http://localhost:${port}`);
});
