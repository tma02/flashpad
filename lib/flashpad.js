var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var seedRandom = require('seedrandom');
var sillyName = require('sillyname');
var path = require('path');
var jsdiff = require('diff');

var production = process.env.NODE_ENV == 'production';
var staging = process.env.NODE_ENV == 'staging';
var local = !production && !staging;

app.set('view engine', 'pug');
app.set('views', './views');

server.listen(process.env.PORT);

app.use('/semantic', express.static(path.join(__dirname, '../node_modules/semantic-ui-css')));
app.use('/jquery', express.static(path.join(__dirname, '../node_modules/jquery/dist')));
app.use('/ace', express.static(path.join(__dirname, '../node_modules/ace-builds/src-min')));
app.use('/marked', express.static(path.join(__dirname, '../node_modules/marked/lib')));
app.use('/diff', express.static(path.join(__dirname, '../node_modules/diff/dist')));
app.use('/static', express.static(path.join(__dirname, '../static')));

app.get('/', function (req, res) {
  res.render('index', { padId: (Math.random()+1).toString(36).substring(7) });
});

app.get('/pad/*', function (req, res) {
  var nsp = io.of(req.url);
  if (!nsp.setup)
    setupSocketHandlers(nsp);
  res.render('pad', { path: req.url, url: production ? 'https://flashpad.herokuapp.com' : (staging ? 'https://flashpad-staging.herokuapp.com' : 'http://localhost') });
});

function setupSocketHandlers(nsp) {
  nsp.file = '';
  nsp.emitNames = function() {
    var names = [];
    for (var socketIdx in nsp.sockets) {
      var socketObj = nsp.sockets[socketIdx];
      names.push({ socketId: socketObj.id, name: socketObj.name, colorId: socketObj.colorId, cursorPosition: socketObj.cursorPosition });
    }
    nsp.emit('names', names);
  }
  nsp.on('connection', function (socket) {
    socket.cursorPosition = { row: 0, column: 0 };
    socket.name = sillyName(seedRandom(socket.id));
    socket.colorId = Math.floor(seedRandom(socket.id)() * 12);
    nsp.emitNames();
    socket.emit('change', { value: nsp.file });
    socket.on('change', function (data) {
      var diff = jsdiff.diffChars(nsp.file, data.value);
      nsp.file = data.value;
      nsp.emit('diff', { socketId: socket.id.split('#')[1], diff: diff });
      for (var socketIdx in nsp.sockets) {
        var socketObj = nsp.sockets[socketIdx];
        if (socket.cursorPosition.row == socketObj.cursorPosition.row && socket.cursorPosition.column < socketObj.cursorPosition.column) {
          socketObj.cursorPosition.column++;
          socketObj.emit('changeCursor', { socketId: socketObj.id.split('#')[1], value: socketObj.cursorPosition });
        }
      }
    });
    socket.on('changeCursor', function (data) {
      socket.cursorPosition = data.value;
      nsp.emit('changeRemoteCursor', { socketId: socket.id.split('#')[1], value: data.value });
    });
    socket.on('disconnect', function() {
      nsp.emitNames();
      nsp.emit('bye', socket.id.split('#')[1]);
    });
  });
  nsp.setup = true;
  clearTimeout(nsp.timeout);
  nsp.timeout = setTimeout(function() {

  }, 1000);
}
