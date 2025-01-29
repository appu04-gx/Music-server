const socket = io();
const uploadForm = document.getElementById('uploadForm');
const uploadInput = document.getElementById('uploadInput');


const serverIdInput = document.getElementById('serverId');
const createServerButton = document.getElementById('createServer');
const joinButton = document.getElementById('joinServer');
const controls = document.getElementById('controls');
const songSelect = document.getElementById('songSelect');
const loadSongButton = document.getElementById('loadSong');
const playButton = document.getElementById('play');
const pauseButton = document.getElementById('pause');
const skipButton = document.getElementById('skip');
const audio = document.getElementById('audioPlayer');
const errorDiv = document.getElementById('error');
const messageDiv = document.getElementById('message');

function showError(message) {
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function clearError() {
  errorDiv.textContent = '';
  errorDiv.style.display = 'none';
}

function showMessage(message) {
  messageDiv.textContent = message;
  messageDiv.style.display = 'block';
}

function clearMessage() {
  messageDiv.textContent = 'none';
  messageDiv.style.display = 'none';
}

function updateSongList(songs) {
  songSelect.innerHTML = '';
  songs.forEach(song => {
    const option = document.createElement('option');
    option.value = song;
    option.textContent = song;
    songSelect.appendChild(option);
  });
}

function updateControls(isCreator) {
  if (isCreator) {
    playButton.style.display = 'inline';
    pauseButton.style.display = 'inline';
    skipButton.style.display = 'inline';
    loadSongButton.style.display = 'inline';
    songSelect.style.display = 'inline';
    audio.controls = true;
  } else {
    playButton.style.display = 'none';
    pauseButton.style.display = 'none';
    skipButton.style.display = 'none';
    loadSongButton.style.display = 'none';
    songSelect.style.display = 'none';
    audio.controls = false;
  }
}

uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const file = uploadInput.files[0];
  if (!file) {
    alert('Please select an MP3 file to upload.');
    return;
  }

  const formData = new FormData();
  formData.append('musicFile', file);

  fetch('/upload', {
    method: 'POST',
    body: formData,
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        alert(data.message);
      }
    })
    .catch((err) => {
      console.error('Error uploading file:', err);
    });
});


createServerButton.addEventListener('click', () => {
  const serverId = serverIdInput.value;
  if (serverId) {
    clearError();
    clearMessage();
    socket.emit('createServer', serverId);
  } else {
    showError('Please enter a valid Server ID');
  }
});


joinButton.addEventListener('click', () => {
  const serverId = serverIdInput.value;
  if (serverId) {
    clearError();
    clearMessage();
    socket.emit('joinServer', serverId);
  } else {
    showError('Please enter a valid Server ID');
  }
});

loadSongButton.addEventListener('click', () => {
  const song = songSelect.value;
  audio.src = `/music/${song}`;
  socket.emit('loadSong', { serverId: serverIdInput.value, song });
});

playButton.addEventListener('click', () => {
  socket.emit('play', { serverId: serverIdInput.value });
  audio.play();
});

pauseButton.addEventListener('click', () => {
  socket.emit('pause', { serverId: serverIdInput.value });
  audio.pause();
});

skipButton.addEventListener('click', () => {
  socket.emit('skip', { serverId: serverIdInput.value });
  audio.currentTime = 0;
});



function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}


audio.addEventListener('timeupdate', debounce(() => {
  if (audio.readyState > 0) {
    socket.emit('seek', { serverId: serverIdInput.value, currentTime: audio.currentTime });
  }
}, 500));

socket.on('songList', (songs) => {
  updateSongList(songs); 
});

socket.on('play', (data) => {
  audio.play();
});
socket.on('newSong', ({ originalName, savedFileName }) => {
  
  const option = document.createElement('option');
  option.value = savedFileName; 
  option.textContent = originalName; 
  songSelect.appendChild(option);
});



socket.on('pause', (data) => {
  audio.pause();
});

socket.on('skip', (data) => {
  audio.currentTime = 0;
});

socket.on('loadSong', (data) => {
  audio.src = `/music/${data.song}`;
  audio.currentTime = data.currentTime || 0;
  if (data.isPlaying) {
    audio.play();
  } else {
    audio.pause();
  }
});

socket.on('seek', (data) => {
  if (typeof data.currentTime === 'number' && !isNaN(data.currentTime)) {
    audio.currentTime = data.currentTime;
  }
});

socket.on('songList', (songs) => {
  updateSongList(songs);
});

socket.on('message', (message) => {
  showMessage(message);
});

socket.on('error', (message) => {
  showError(message);
  controls.style.display = 'none';
});

socket.on('serverClosed', (message) => {
  showError(message);
  controls.style.display = 'none';
  serverIdInput.value = '';
});

socket.on('isCreator', (isCreator) => {
  updateControls(isCreator);
  controls.style.display = 'block';
});