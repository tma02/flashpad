prodName = 'Flashpad';

editor.on('change', function() {
  $('#preview').html(filterXSS(marked(editor.getValue())));
});
