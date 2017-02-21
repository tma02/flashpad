prodName = 'Flashslide';
var presentMode = false;

if (window.location.hash.substr(1) === 'present') {
  presentMode = true;
  $('#editor').css('width', '0');
  $('#preview').css('width', '100%');
  $('#preview').css('left', '0');
  $('.progress').css('width', '100%');
  $('.progress').css('margin-left', '0');
  $('#menu').append('<a class="item" id="present">Edit</a>');
}
else {
  $('#menu').append('<a class="item" id="present">Present</a>');
}

$('#present').click(function() {
  if (presentMode) {
    location.hash = '';
  }
  else {
    location.hash = 'present';
  }
  location.reload();
});

Reveal.initialize({
  help: false,
  dependencies: [
    { src: '/reveal.js/plugin/markdown/marked.js' },
    { src: '/reveal.js/plugin/markdown/markdown.js' },
    { src: '/reveal.js/plugin/highlight/highlight.js', async: true, callback: function() { hljs.initHighlightingOnLoad(); } }
  ]
});

editor.on('change', function() {
  $('.slides').html('');
  var slides = editor.getValue().split('#HSLIDE');
  for (var slideIdx in slides) {
    var slide = slides[slideIdx];
    $('.slides').append('<section data-markdown><script type="text/template">' + slide + '</script></section>');
  }
  RevealMarkdown.convertSlides();
  var currentIdx = Reveal.getIndices();
  Reveal.sync();
  // TODO: move to slide the cursor is currently in
  Reveal.slide(currentIdx.h, currentIdx.v);
});
