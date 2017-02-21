var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var seedRandom = require('seedrandom');
var sillyName = require('sillyname');
var path = require('path');
var DiffMatchPatch = require('diff-match-patch');
var dmp = new DiffMatchPatch();

var production = process.env.NODE_ENV == 'production';
var staging = process.env.NODE_ENV == 'staging';
var local = !production && !staging;

var updateCursorsFlag = false;
var updateCursorsOrigin = '';

var idsInUse = [];

app.set('view engine', 'pug');
app.set('views', './views');

server.listen(process.env.PORT);

app.use('/semantic', express.static(path.join(__dirname, '../node_modules/semantic-ui-css')));
app.use('/jquery', express.static(path.join(__dirname, '../node_modules/jquery/dist')));
app.use('/ace', express.static(path.join(__dirname, '../node_modules/ace-builds/src-min')));
app.use('/marked', express.static(path.join(__dirname, '../node_modules/marked/lib')));
app.use('/diff-match-patch', express.static(path.join(__dirname, '../node_modules/diff-match-patch/')));
app.use('/reveal.js', express.static(path.join(__dirname, '../node_modules/reveal.js/')));
app.use('/headjs', express.static(path.join(__dirname, '../node_modules/headjs/dist/1.0.0/')));
app.use('/static', express.static(path.join(__dirname, '../static')));

app.get('/', function (req, res) {
  var roomId = genId();
  res.render('index', { roomId: roomId });
});

app.get('/pad/*', function (req, res) {
  var roomId = req.url.split('/')[(req.url.split('/').length - 1)];
  var newId = genId();
  initRoomNsp(roomId);
  res.render('pad', { title: 'Flashpad', newId: newId, roomId: roomId, url: production ? 'https://flashpad.herokuapp.com' : (staging ? 'https://flashpad-staging.herokuapp.com' : 'http://localhost') });
});

app.get('/slide/*', function (req, res) {
  var roomId = req.url.split('/')[(req.url.split('/').length - 1)];
  var newId = genId();
  initRoomNsp(roomId);
  res.render('slide', { title: 'Flashslide', newId: newId, roomId: roomId, url: production ? 'https://flashpad.herokuapp.com' : (staging ? 'https://flashpad-staging.herokuapp.com' : 'http://localhost') });
});

function genId() {
  var roomId = (Math.random()+1).toString(36).substring(20);
  while (idsInUse.indexOf(roomId) != -1) {
    roomId = (Math.random()+1).toString(36).substring(20)
  }
  return roomId;
}

function initRoomNsp(roomId) {
  var nsp = io.of(roomId);
  nsp.roomId = roomId;
  idsInUse.push(roomId);
  if (!nsp.setup) {
    setupSocketHandlers(nsp);
  }
}

function setupSocketHandlers(nsp) {
  nsp.file = '';
  nsp.emitNames = function() {
    var names = [];
    for (var socketIdx in nsp.sockets) {
      var socketObj = nsp.sockets[socketIdx];
      names.push({ socketId: stripNsp(socketObj.id), name: socketObj.name, colorId: socketObj.colorId, cursorPosition: socketObj.cursorPosition });
    }
    nsp.emit('names', names);
  }
  nsp.on('connection', function (socket) {
    socket.cursorPosition = { row: 0, column: 0 };
    socket.lastUpdatePosition = socket.cursorPosition;
    socket.cursorDelta = socket.cursorPosition;
    socket.name = sillyName(seedRandom(socket.id));
    socket.colorId = Math.floor(seedRandom(socket.id)() * 12);
    nsp.emitNames();
    socket.emit('change', { value: nsp.file });
    socket.on('change', function (data) {
      var patches = dmp.patch_fromText(data.diff);
      var results = dmp.patch_apply(patches, nsp.file);
      nsp.file = results[0];
      nsp.emit('diff', { socketId: stripNsp(socket.id), diff: data.diff });
      updateCursorsFlag = true;
      updateCursorsOrigin = socket.id;
    });
    socket.on('changeCursor', function (data) {
      socket.cursorDelta = { row: data.value.row - socket.lastUpdatePosition.row, column: data.value.column - socket.lastUpdatePosition.column };
      socket.cursorPosition = data.value;
      nsp.emit('changeRemoteCursor', { socketId: stripNsp(socket.id), value: data.value });
      if (updateCursorsFlag && updateCursorsOrigin === socket.id) {
        for (var socketIdx in nsp.sockets) {
          var socketObj = nsp.sockets[socketIdx];
          if (socketObj.id !== socket.id) {
            if (socket.cursorPosition.row == socketObj.cursorPosition.row && socket.cursorPosition.column < socketObj.cursorPosition.column) {
              socketObj.cursorPosition.column += socket.cursorDelta.column;
            }
            if ((socket.cursorPosition.column - socket.cursorDelta.column) < socketObj.cursorPosition.column && socket.cursorDelta.row != 0) {
              socketObj.cursorPosition.row += socket.cursorDelta.row;
            }
            socketObj.emit('changeCursor', { socketId: stripNsp(socketObj.id), value: socketObj.cursorPosition });
            nsp.emit('changeRemoteCursor', { socketId: stripNsp(socketObj.id), value: socketObj.cursorPosition });
          }
        }
        updateCursorsFlag = false;
      }
      socket.lastUpdatePosition = socket.cursorPosition;
    });
    socket.on('selectionRange', function (data) {
      socket.selectionRange = data.value;
      nsp.emit('changeRemoteSelection', { socketId: stripNsp(socket.id), value: socket.selectionRange });
    });
    socket.on('disconnect', function() {
      nsp.emitNames();
      nsp.emit('bye', stripNsp(socket.id));
      if (Object.keys(nsp.sockets).length == 0) {
        setTimeout(function() {
          if (Object.keys(nsp.sockets).length == 0) {
            nsp.file = '';
            delete idsInUse[idsInUse.indexOf(nsp.roomId)];
          }
        }, 10 * 60 * 1000); // 10 minutes
      }
    });
  });
  nsp.setup = true;
  clearTimeout(nsp.timeout);
  nsp.timeout = setTimeout(function() {
    // What was this for again?
  }, 1000);
}

function stripNsp(socketId) {
  return socketId.split('#')[1] || socketId;
}