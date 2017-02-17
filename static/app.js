var editor = ace.edit('editor');
var socket = io(path);
var fromSocket = false;

var colors = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 
              'blue', 'violet', 'purple', 'pink', 'brown', 'grey'];

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/markdown');
editor.$blockScrolling = Infinity;
editor.setShowPrintMargin(false);

editor.on('change', function() {
  if (!fromSocket) {
    socket.emit('change', { socketId: socket.id, value: editor.getValue() });
  }
  $('#preview').html(marked(editor.getValue()));
});
editor.selection.on('changeCursor', function() {
  socket.emit('changeCursor', { socketId: socket.id, value: editor.getCursorPosition() });
});
editor.commands.addCommand({
  name: 'saveFile',
  bindKey: {
    win: 'Ctrl-S',
    mac: 'Command-S',
    sender: 'editor|cli'
  },
  exec: function(env, args, request) { }
});

socket.on('change', function(data) {
  if (data.socketId != socket.id) {
    var oldCursorPosition = editor.getCursorPosition();
    fromSocket = true;
    editor.setValue(data.value);
    fromSocket = false;
    editor.clearSelection();
    editor.moveCursorToPosition(oldCursorPosition);
  }
});

socket.on('diff', function(data) {
  if (data.socketId != socket.id) {
    var oldCursorPosition = editor.getCursorPosition();
    var result = editor.getValue();
    var pos = 0;
    var delta = data.diff;
    for(var i = 0; i < delta.length; i++){
      if(delta[i].added){
        result = insertAt(result, pos, delta[i].value);
        pos += delta[i].count;
      }
      else if (delta[i].removed) {
        result = removeAt(result, pos, delta[i].count);
      }
      else {
        pos += delta[i].count;
      }
    }
    fromSocket = true;
    editor.setValue(result);
    fromSocket = false;
    editor.clearSelection();
    editor.moveCursorToPosition(oldCursorPosition);
  }
});
socket.on('changeCursor', function(data) {
  if (data.socketId == socket.id) {
    editor.moveCursorToPosition(data.value);
  }
});
socket.on('changeRemoteCursor', function(data) {
  if (data.socketId != socket.id) {
    updateRemoteCursor(data.socketId, data.value);
  }
});
socket.on('names', function(names) {
  console.log(names);
  $('#connected').html('');
  for (var nameIdx in names) {
    var name = names[nameIdx];
    $('#connected').append('<span class="active ' + colors[name.colorId] + ' item">' + name.name + '</span>');
    if (name.socketId.split('#')[1] != socket.id) {
      addRemoteCursor(name.socketId.split('#')[1], name.colorId, name.name, name.cursorPosition);
    }
  }
});
socket.on('bye', function(socketId) {
  removeRemoteCursor(socketId);
});

$('#share').click(function() {
  $('.ui.modal').modal('show');
});
$('#copy-button').click(function() {
  var textArea = document.createElement('textarea');
  textArea.value = $('#copy-url').html();
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
});

var marker = {};
marker.cursors = {};
marker.update = function(html, markerLayer, session, config) {
  var start = config.firstRow;
  var end = config.lastRow;
  var cursors = this.cursors;
  for (var i in cursors) {
    console.log(this.cursors[i]);
    var pos = this.cursors[i].cursorPosition;
    var color = colors[this.cursors[i].colorId];
    if (pos.row < start) {
      continue;
    }
    else if (pos.row > end) {
      break;
    }
    else {
      var screenPos = session.documentToScreenPosition(pos);
      var height = config.lineHeight;
      var width = config.characterWidth;
      var top = markerLayer.$getTop(screenPos.row, config);
      var left = markerLayer.$padding + screenPos.column * width;
      html.push('<div class="' + color + '-cursor remote-cursor" style="',
        'height:', height, 'px;', 'top:', top, 'px;',
        'left:', left, 'px; width:', width, 'px"></div>');
    }
  }
}
marker.redraw = function() {
  this.session._signal('changeFrontMarker');
}
marker.addCursor = function() {
  marker.redraw();
}
marker.session = editor.session;
marker.session.addDynamicMarker(marker, true);

function addRemoteCursor(socketId, colorId, name, cursorPosition) {
  var cursorObj = {};
  cursorObj.colorId = colorId;
  cursorObj.name = name;
  cursorObj.cursorPosition = cursorPosition;
  marker.cursors[socketId] = cursorObj;
  marker.redraw();
}

function updateRemoteCursor(socketId, cursorPosition) {
  var cursor = marker.cursors[socketId];
  cursor.cursorPosition = cursorPosition;
  marker.redraw();
}

function removeRemoteCursor(socketId) {
  marker.cursors[socketId] = null;
  delete marker.cursors[socketId];
}

function insertAt(str, index, add) {
  return str.slice(0, index) + add + str.slice(index);
}

function removeAt(str, index, count) {
  return str.slice(0, index) + str.slice(index + count);
}