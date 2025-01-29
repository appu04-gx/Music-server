const express = require('express');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const upload = multer({ dest: path.join(__dirname, 'music') });
  
app.use(cors());
app.use(express.static('public'));
app.use('/music', express.static('music'));

app.post('/upload', upload.single('musicFile'), (req, res) => {
  if (req.file) {
    const originalName = req.file.originalname; 
    const savedFileName = req.file.filename;
    res.status(200).json({ message: 'File uploaded successfully', fileName: req.file.originalname });
    io.emit('newSong', { originalName: req.file.originalname, savedFileName: req.file.filename });
 
    res.status(400).json({ message: 'Failed to upload file' });
  }
});

const servers = new Map();


function getSongList() {
  const musicDir = path.join(__dirname, 'music');
  return fs.readdirSync(musicDir).filter(file => file.endsWith('.mp3'));
}

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
    const serverId = socket.serverId;
    if (serverId) {
      const server = servers.get(serverId);
      if (server && server.creator === socket.id) {
        io.to(serverId).emit('serverClosed', 'The server has been closed by the creator');
        servers.delete(serverId);
        console.log(`Server ${serverId} closed`);
      } else {
        server.users.delete(socket.id);
        if (server.users.size === 0) {
          servers.delete(serverId);
          console.log(`Server ${serverId} closed due to no users`);
        }
      }
    }
  });

  socket.on('createServer', (serverId) => {
    if (servers.has(serverId)) {
      socket.emit('error', 'Server ID already exists');
    } else {
      servers.set(serverId, { creator: socket.id, users: new Set([socket.id]), currentSong: null, currentTime: 0, isPlaying: false });
      socket.serverId = serverId;
      socket.join(serverId);
      console.log(`Server ${serverId} created`);
      socket.emit('message', 'Server created successfully');
      socket.emit('songList', getSongList());
      socket.emit('isCreator', true);
    }
  });

  socket.on('joinServer', (serverId) => {
    if (!servers.has(serverId)) {
      socket.emit('error', 'Server ID does not exist');
    } else {
      const server = servers.get(serverId);
      server.users.add(socket.id);
      socket.serverId = serverId;
      socket.join(serverId);
      console.log(`User joined server ${serverId}`);
      socket.emit('message', 'Joined server successfully');
      socket.emit('isCreator', false);
      if (server.currentSong) {
        socket.emit('loadSong', { song: server.currentSong, currentTime: server.currentTime, isPlaying: server.isPlaying });
      }
    }
  });

  socket.on('play', (data) => {
    const serverId = socket.serverId;
    const server = servers.get(serverId);
    if (server && server.creator === socket.id) {
      server.isPlaying = true;
      io.to(serverId).emit('play', data);
    } else {
      socket.emit('error', 'Only the server creator can control the music');
    }
  });

  socket.on('pause', (data) => {
    const serverId = socket.serverId;
    const server = servers.get(serverId);
    if (server && server.creator === socket.id) {
      server.isPlaying = false;
      io.to(serverId).emit('pause', data);
    } else {
      socket.emit('error', 'Only the server creator can control the music');
    }
  });

  socket.on('skip', (data) => {
    const serverId = socket.serverId;
    const server = servers.get(serverId);
    if (server && server.creator === socket.id) {
      server.currentTime = 0;
      server.isPlaying = false;
      io.to(serverId).emit('skip', data);
    } else {
      socket.emit('error', 'Only the server creator can control the music');
    }
  });

  socket.on('loadSong', (data) => {
    const serverId = socket.serverId;
    const server = servers.get(serverId);
    if (server && server.creator === socket.id) {
      server.currentSong = data.song;
      server.currentTime = 0;
      server.isPlaying = false;
      io.to(serverId).emit('loadSong', data);
    } else {
      socket.emit('error', 'Only the server creator can control the music');
    }
  });

  socket.on('seek', (data) => {
    const serverId = socket.serverId;
    const server = servers.get(serverId);
    if (server && server.creator === socket.id) {
      server.currentTime = data.currentTime;
      io.to(serverId).emit('seek', data);
    } else {
      socket.emit('error', 'Only the server creator can control the music');
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});