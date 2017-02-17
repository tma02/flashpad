var editor = ace.edit('editor');
var socket = io(path);
var fromSocket = false;

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/javascript');
editor.$blockScrolling = Infinity;
editor.on('change', function() {
  if (!fromSocket)
    socket.emit('change', { socketId: socket.id, value: editor.getValue() });
});
editor.selection.on('changeCursor', function() {
  socket.emit('changeCursor', { socketId: socket.id, value: editor.getCursorPosition() })
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
socket.on('changeCursor', function(data) {
  editor.moveCursorToPosition(data.value);
});
socket.on('name', function(name) {
  console.log(name);
});