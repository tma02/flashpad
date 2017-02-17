var editor = ace.edit('editor');
var socket = io(path);
var dmp = new diff_match_patch();
var fromSocket = false;
var oldText = '';

var colors = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 
              'blue', 'violet', 'purple', 'pink', 'brown', 'grey'];

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/markdown');
editor.$blockScrolling = Infinity;
editor.setShowPrintMargin(false);

editor.on('change', function() {
  if (!fromSocket) {
    var newText = editor.getValue();
    var diff = dmp.diff_main(oldText, newText, true);
    if (diff.length > 2) {
      dmp.diff_cleanupSemantic(diff);
    }
    var patchList = dmp.patch_make(oldText, newText, diff);
    patchText = dmp.patch_toText(patchList);
    socket.emit('change', { socketId: socket.id, diff: patchText });
    oldText = newText;
  }
  $('#preview').html(marked(editor.getValue()));
});
editor.selection.on('changeCursor', function() {
  console.log(fromSocket);
  if (!fromSocket) {
    socket.emit('changeCursor', { socketId: socket.id, value: editor.getCursorPosition() });
  }
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
  if (data.socketId !== socket.id) {
    var oldSelection = editor.selection.getRange();
    var oldCursorPosition = editor.getCursorPosition();
    oldText = data.value;
    fromSocket = true;
    editor.setValue(data.value);
    editor.clearSelection();
    editor.selection.setRange(oldSelection);
    editor.moveCursorToPosition(oldCursorPosition);
    fromSocket = false;
  }
});

socket.on('diff', function(data) {
  if (data.socketId !== socket.id) {
    var oldSelection = editor.selection.getRange();
    var oldCursorPosition = editor.getCursorPosition();
    var patches = dmp.patch_fromText(data.diff);
    var results = dmp.patch_apply(patches, editor.getValue());
    oldText = results[0];
    fromSocket = true;
    editor.setValue(results[0]);
    editor.clearSelection();
    editor.selection.setRange(oldSelection);
    editor.moveCursorToPosition(oldCursorPosition);
    fromSocket = false;
  }
});
socket.on('changeCursor', function(data) {
  if (data.socketId === socket.id) {
    fromSocket = true;
    editor.moveCursorToPosition(data.value);
    fromSocket = false;
  }
});
socket.on('changeRemoteCursor', function(data) {
  if (data.socketId !== socket.id) {
    updateRemoteCursor(data.socketId, data.value);
  }
});
socket.on('names', function(names) {
  console.log(names);
  $('#connected').html('');
  for (var nameIdx in names) {
    var name = names[nameIdx];
    if (name.socketId.split('#')[1] !== socket.id) {
      addRemoteCursor(name.socketId.split('#')[1], name.colorId, name.name, name.cursorPosition);
      $('#connected').append('<span class="active ' + colors[name.colorId] + ' item">' + name.name + '</span>');
    }
    else {
      $('#connected').append('<span class="active ' + colors[name.colorId] + ' item"><i class="text cursor icon"></i>' + name.name + '</span>');
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
  marker.redraw();
}
