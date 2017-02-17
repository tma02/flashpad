var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var seedRandom = require('seedrandom');
var sillyName = require('sillyname');
var path = require('path');

var production = process.env.NODE_ENV == 'production';

app.set('view engine', 'pug');
app.set('views', './views');
server.listen(process.env.PORT);

app.use('/semantic', express.static(path.join(__dirname, '../node_modules/semantic-ui-css')));
app.use('/ace', express.static(path.join(__dirname, '../node_modules/ace-builds/src-min')));
app.use('/static', express.static(path.join(__dirname, '../static')));
app.get('/', function (req, res) {
  res.render('index');
});

app.get('/pad/*', function (req, res) {
  var nsp = io.of(req.url);
  if (!nsp.setup)
    setupSocketHandlers(nsp);
  res.render('pad', { path: req.url, url: production ? 'https://flashpad.herokuapp.com' : 'http://localhost' });
});

function setupSocketHandlers(nsp) {
  nsp.on('connection', function (socket) {
    socket.cursorPosition = { row: 0, column: 0 };
    socket.name = sillyName(seedRandom(socket.id));
    for (var socketIdx in nsp.sockets) {
      var socketObj = nsp.sockets[socketIdx];
      socket.emit('name', { socketId: socketObj.id, name: socketObj.name });
    }
    socket.on('change', function (data) {
      nsp.emit('change', data);
      for (var socketIdx in nsp.sockets) {
        var socketObj = nsp.sockets[socketIdx];
        if (socket.cursorPosition.row == socketObj.cursorPosition.row && socket.cursorPosition.column < socketObj.cursorPosition.column) {
          socketObj.cursorPosition.column++;
          socketObj.emit('changeCursor', { socketId: socketObj.id, value: socketObj.cursorPosition });
        }
      }
    });
    socket.on('changeCursor', function (data) {
      socket.cursorPosition = data.value;
    });
  });
  nsp.setup = true;
  clearTimeout(nsp.timeout);
  nsp.timeout = setTimeout(function() {

  }, 1000);
}
