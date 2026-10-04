import 'dotenv/config';

import cors
  from 'cors';

import express
  from 'express';

import notificationRoutes
  from './routes/notifications';

const app =
  express();

app.use(
  cors()
);

app.use(
  express.json({
    limit: '32kb',
  })
);

app.get(
  '/',
  (
    _request,
    response
  ) => {
    response.json({
      name:
        'Firebase Chat API',

      status:
        'online',
    });
  }
);

app.get(
  '/health',
  (
    _request,
    response
  ) => {
    response.json({
      status: 'ok',
      timestamp:
        new Date()
          .toISOString(),
    });
  }
);

app.use(
  '/notifications',
  notificationRoutes
);

const port =
  Number(
    process.env.PORT ??
      3000
  );

app.listen(
  port,
  '0.0.0.0',
  () => {
    console.log(
      `✅ API rodando na porta ${port}`
    );
  }
);