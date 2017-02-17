var editor = ace.edit('editor');
var socket = io(path);
var fromSocket = false;

var colors = ['red', 'orange', 'yellow', 'olive', 'green', 'teal', 
              'blue', 'violet', 'purple', 'pink', 'brown', 'grey'];

editor.setTheme('ace/theme/monokai');
editor.getSession().setMode('ace/mode/markdown');
editor.$blockScrolling = Infinity;

editor.on('change', function() {
  if (!fromSocket) {
    socket.emit('change', { socketId: socket.id, value: editor.getValue() });
  }
  $('#preview').html(marked(editor.getValue()));
});
editor.selection.on('changeCursor', function() {
  socket.emit('changeCursor', { socketId: socket.id, value: editor.getCursorPosition() })
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
socket.on('changeCursor', function(data) {
  editor.moveCursorToPosition(data.value);
});
socket.on('names', function(names) {
  console.log(names);
  $('#connected').html('');
  for (var nameIdx in names) {
    var name = names[nameIdx];
    $('#connected').append('<span class="active ' + colors[name.color] + ' item">' + name.name + '</span>');
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
