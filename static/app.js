// Definitions
var editor = ace.edit('editor');
var Range = ace.require('ace/range').Range;
var socket = io('/' + roomId);
var dmp = new diff_match_patch();

var fromSocket = false;
var overrideLocalCursorPosition = false;
var oldText = '';
var prodName = 'Flash';
var saved = true;

var colors = ['red', 'orange', 'yellow', 'olive', 'green', 'teal',
              'blue', 'violet', 'purple', 'pink', 'brown', 'grey'];

var colorsHex = ['DB2828', 'F2711C', 'FBBD08', 'B5CC18', '21BA45', '00B5AD',
                '2185D0', '6435C9', 'A333C8', 'E03997', 'A5673F', '767676'];

var _names = {};
var _selections = {};
var _currentFileName = '';
var _path = '/';

// Ace configuration

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/markdown');
editor.$blockScrolling = Infinity;
editor.setShowPrintMargin(false);
editor.commands.addCommand({
  name: 'saveFile',
  bindKey: {
    win: 'Ctrl-S',
    mac: 'Command-S',
    sender: 'editor|cli'
  },
  exec: function(env, args, request) {
    $('#save').trigger('click');
  }
});

// Ace events
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
  document.title = _currentFileName + '* | ' + prodName;
  saved = false;
});
editor.selection.on('changeCursor', function() {
  if (!fromSocket) {
    socket.emit('changeCursor', { socketId: socket.id, value: editor.getCursorPosition() });
  }
});
editor.session.on('changeBackMarker', function() {
  if (!fromSocket) {
    socket.emit('selectionRange', { socketId: socket.id, value: editor.selection.getRange() });
  }
});

// Socket.io events
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
    if (!overrideLocalCursorPosition) {
      editor.moveCursorToPosition(oldCursorPosition);
    }
    overrideLocalCursorPosition = false;
    fromSocket = false;
  }
});
socket.on('changeCursor', function(data) {
  if (data.socketId === socket.id) {
    fromSocket = true;
    editor.moveCursorToPosition(data.value);
    overrideLocalCursorPosition = true;
    fromSocket = false;
  }
});
socket.on('changeRemoteCursor', function(data) {
  if (data.socketId !== socket.id) {
    updateRemoteCursor(data.socketId, data.value);
  }
});
socket.on('changeRemoteSelection', function(data) {
  if (data.socketId !== socket.id) {
    updateRemoteSelection(data.socketId, _names[data.socketId].colorId, data.value);
  }
});
socket.on('names', function(names) {
  $('#connected').html('');
  _names = {};
  for (var nameIdx in names) {
    var name = names[nameIdx];
    _names[name.socketId] = name;
    if (name.socketId !== socket.id) {
      addRemoteCursor(name.socketId, name.colorId, name.name, name.cursorPosition);
      $('#connected').prepend('<span class="active ' + colors[name.colorId] + ' item">' + name.name + '</span>');
    }
    else {
      $('#connected').prepend('<span class="active ' + colors[name.colorId] + ' item"><i class="text cursor icon"></i>' + name.name + '</span>');
    }
  }
});
socket.on('bye', function(socketId) {
  removeRemoteCursor(socketId);
});

// jQuery events
$('#new').click(function() {
  location.assign(newId);
});
$('#open').click(function() {
  populateBrowserWindow(_path);
  $('#browse').modal('show');
});
$('#save').click(function() {
  if (_currentFileName == '') {
    $('#save-as').modal('show');
  }
  else {
    save(_currentFileName);
  }
});
$('#share').click(function() {
  $('#collab-link').modal('show');
});
$('#copy-button').click(function() {
  var textArea = document.createElement('textarea');
  textArea.value = $('#copy-url').html();
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
});
$('#save-btn').click(function() {
  _currentFileName = $('#file-name').val() + '.md';
  save(_currentFileName);
});
$('#file-name').on('keyup', function (e) {
  if (e.keyCode == 13) {
    $('#save-btn').trigger('click');
  }
});
$(window).bind('beforeunload', function() {
  if (!saved) {
    return 'You have unsaved changes on this page. Do you want to leave this page and discard your changes or stay on this page?';
  }
});

// Cursor sync logic
function updateRemoteSelection(socketId, colorId, range) {
  if (range.start.row == range.end.row && range.start.column == range.end.column) {
    if (_selections[socketId] != undefined) {
      editor.session.removeMarker(_selections[socketId]);
      delete _selections[socketId];
    }
    return;
  }
  range = new Range(range.start.row, range.start.column, range.end.row, range.end.column);
  fromSocket = true;
  if (_selections[socketId] != undefined) {
    editor.session.getMarkers()[_selections[socketId]].range = range;
    editor.session._signal('changeBackMarker');
  }
  else {
    var marker = editor.session.addMarker(range, colors[colorId] + '-selection ace_selection', 'selection', false);
    _selections[socketId] = marker;
  }
  fromSocket = false;
}

var marker = {};
marker.cursors = {};
marker.update = function(html, markerLayer, session, config) {
  var start = config.firstRow;
  var end = config.lastRow;
  var cursors = this.cursors;
  for (var i in cursors) {
    var pos = this.cursors[i].cursorPosition;
    var colorHex = colorsHex[this.cursors[i].colorId];
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
      html.push('<div class="remote-cursor" style="',
        'height:', height, 'px;', 'top:', top, 'px;',
        'left:', left, 'px; width:', width, 'px; border-left: 2px solid #' + colorHex, ';"></div>');
    }
  }
}
marker.redraw = function() {
  this.session._signal('changeFrontMarker');
}
marker.session = editor.session;
marker.session.addDynamicMarker(marker, true);

function updateLocalCursor(diffOriginSocketId) {
  var cursor = marker.cursors[diffOriginSocketId];
}

function addRemoteCursor(socketId, colorId, name, cursorPosition) {
  var cursorObj = {};
  cursorObj.colorId = colorId;
  cursorObj.name = name;
  cursorObj.cursorPosition = cursorPosition;
  cursorObj.cursorDelta = { row: 0, column: 0 };
  marker.cursors[socketId] = cursorObj;
  marker.redraw();
}

function updateRemoteCursor(socketId, cursorPosition) {
  var cursor = marker.cursors[socketId];
  cursor.cursorDelta = { };
  cursor.cursorPosition = cursorPosition;
  marker.redraw();
}

function removeRemoteCursor(socketId) {
  delete marker.cursors[socketId];
  marker.redraw();
}

// File save/open logic
initLocalStorage();

function initLocalStorage() {
  localStorage.paths = localStorage.paths || JSON.stringify({});
  getPath('/');
  localStorage.files = localStorage.files || JSON.stringify({});
}

function getPath(pathName) {
  var paths = JSON.parse(localStorage.paths);
  paths[pathName] = paths[pathName] || {
    files: {}
  };
  localStorage.paths = JSON.stringify(paths);
  return paths[pathName];
}

function getFile(pathName, name) {
  var path = getPath(pathName);
  var fileId = Object.keys(JSON.parse(localStorage.files)).length;
  if (path.files[name] != undefined) {
    return path.files[name].id;
  }
  path.files[name] = path.files[name] || {
    id: fileId,
    name: name
  };
  var paths = JSON.parse(localStorage.paths);
  paths[pathName] = path;
  localStorage.paths = JSON.stringify(paths);
  var files = JSON.parse(localStorage.files);
  files[fileId] = {
    value: ''
  };
  localStorage.files = JSON.stringify(files);
  return fileId;
}

function save() {
  var fileId = getFile(_path, _currentFileName);
  var path = getPath(_path);
  var files = JSON.parse(localStorage.files);
  files[fileId].value = editor.getValue();
  localStorage.files = JSON.stringify(files);
  document.title = _currentFileName + ' | ' + prodName;
  saved = true;
}

function populateBrowserWindow(pathName) {
  var path = getPath(pathName);
  $('#file-list').html('');
  for (var fileName in path.files) {
    var pathFile = path.files[fileName];
    var file = JSON.parse(localStorage.files)[pathFile.id];
    $('#file-list').append('<div class="item"><i class="middle aligned file text icon"></i><div class="content"><a class="header open-file" filename="' + pathFile.name + '">' + pathFile.name + '</a><div class="description"><a class="delete-file" filename="' + pathFile.name + '"><i class="trash icon"></i></a></div></div></div>');
  }
  $('.delete-file').click(function() {
    var fileName = $(this).attr('filename');
    $('#delete-confirm').modal({
      allowMultiple: true,
      onApprove: function() {
        deleteFile(_path, fileName);
        populateBrowserWindow(pathName);
      }
    });
    $('#delete-confirm').modal('show');
  });
  $('.open-file').click(function() {
    var fileName = $(this).attr('filename');
    open(_path, fileName);
    $('#browse').modal('hide');
  });
}

function deleteFile(pathName, fileName) {
  console.log(fileName);
  var paths = JSON.parse(localStorage.paths);
  var path = getPath(pathName);
  var fileId = getFile(pathName, fileName);
  var files = JSON.parse(localStorage.files);
  delete files[fileId];
  localStorage.files = JSON.stringify(files);
  delete path.files[fileName];
  paths[pathName] = path;
  localStorage.paths = JSON.stringify(paths);
}

function open(pathName, fileName) {
  var path = getPath(pathName);
  var fileId = getFile(_path, fileName);
  var files = JSON.parse(localStorage.files);
  editor.setValue(files[fileId].value);
  _currentFileName = fileName;
  document.title = _currentFileName + ' | ' + prodName;
  saved = true;
}
