import express from 'express';
import { router } from './routes.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3010');

app.use(express.json());
app.use('/api', router);

app.listen(PORT, () => {
  console.log(`Analyzer service running on port ${PORT}`);
});

export { app };
