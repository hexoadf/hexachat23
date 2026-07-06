require('dotenv').config();
const express = require('express');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');
const { setupSecurity } = require('./middleware/security');
const routes = require('./routes');
const { setupSocket } = require('./socket');
const { allowedOrigins } = require('./config/cors');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling']
});

app.set('io', io);
setupSecurity(app);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', routes);

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: 'File too large or invalid' });
  }
  if (err.message === 'File type not allowed') {
    return res.status(400).json({ success: false, message: err.message });
  }
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

setupSocket(io);

server.listen(PORT, () => {
  console.log(`HexaChat Backend running on port ${PORT}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
});
