prodName = 'Flashpad';

editor.on('change', function() {
  $('#preview').html(marked(editor.getValue()));
});
