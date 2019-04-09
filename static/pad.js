prodName = 'Flashpad';

editor.on('change', function() {
  $('#preview').html(marked(escapeHtml(editor.getValue())));
});
