const express = require('express');
const connectDB = require('./config/db');

const Game = require('./models/Game');
const User = require('./models/User');

const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Connect database
connectDB();

// Init Middleware
app.use(express.json({ extended: false }));

app.get('/', (req, res) => res.send('API Running'));

// Define Routes
app.use('/api/users', require('./routes/api/users'));
app.use('/api/auth', require('./routes/api/auth'));
app.use('/api/matches', require('./routes/api/matches'));
app.use('/api/games', require('./routes/api/games'));
app.use('/api/teams', require('./routes/api/teams'));
app.use('/api/results', require('./routes/api/results'));

const changeStream = Game.watch();

// Run when client connects
io.on('connection', socket => {
  console.log('New client connected');

  changeStream.on('change', async (change) => {
    console.log('Collection changed');
    const results = await Game.findOne({ _id: change.documentKey._id }).select('players').populate('players.user', 'username', User);
    socket.emit('updateScore', results);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => console.log(`Server started on port ${PORT}`));

module.exports = io;