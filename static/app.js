var editor = ace.edit('editor');
var socket = io(path);
var fromSocket = false;

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/markdown');
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
socket.on('names', function(names) {
  $('#connected').html('');
  for (var nameIdx in names) {
    var name = names[nameIdx];
    $('#connected').append('<span class="item" socket-id="' + name.socketId + '">' + name.name + '</span>');
  }
});
$('#share').click(function() {
  $('.ui.modal').modal('show');
});
$('#copy-button').click(function() {
  var textArea = document.createElement("textarea");
  textArea.value = $('#copy-url').html();
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  textArea.remove();
});