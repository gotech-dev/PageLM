// IMPORTANT: Import env loader FIRST to load environment variables before any other modules
import '../config/env'

import cors from 'cors';
import server from '../utils/server/server'
import { registerRoutes } from './router'
import { loggerMiddleware } from './middleware'

const app = server()

app.use(loggerMiddleware)
app.use(cors({
  origin: "*",
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('*', cors());
app.use(app.serverStatic("/storage", "./storage"))

registerRoutes(app)

app.listen(Number.parseInt(process.env.PORT || '5001'), () => {
  console.log(`[pagelm] running on ${process.env.VITE_BACKEND_URL || 'http://localhost:5001'}`)
})