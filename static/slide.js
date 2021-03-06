prodName = 'Flashslide';
var presentMode = false;

$('#menu').append('<a class="item" id="present">Present</a>');

document.addEventListener('webkitfullscreenchange', fullscreenChange, false);
document.addEventListener('mozfullscreenchange', fullscreenChange, false);
document.addEventListener('fullscreenchange', fullscreenChange, false);
document.addEventListener('MSFullscreenChange', fullscreenChange, false);

Reveal.initialize({
  help: false,
  dependencies: [
    { src: '/reveal.js/plugin/markdown/marked.js' },
    { src: '/reveal.js/plugin/markdown/markdown.js' },
    { src: '/reveal.js/plugin/highlight/highlight.js', async: true, callback: function() { hljs.initHighlightingOnLoad(); } }
  ]
});

Reveal.addEventListener('ready', function(event) {
  if (window.location.hash.substr(1) === 'present') {
    setupPresentMode();
  }
  else {
    setupEditMode();
  }
});

function setupPresentMode() {
  presentMode = true;
  $('#editor').css('width', '0');
  $('#preview').css('width', '100%');
  $('#preview').css('left', '0');
  $('.progress').css('width', '100%');
  $('.progress').css('margin-left', '0');
  $('#present').html('Edit');
  location.hash = 'present';
  Reveal.layout();
}

function setupEditMode() {
  presentMode = false;
  $('#editor').css('width', '50%');
  $('#preview').css('width', '50%');
  $('#preview').css('left', '50%');
  $('.progress').css('width', '50%');
  $('.progress').css('margin-left', '50%');
  $('#present').html('Present');
  location.hash = '';
  Reveal.layout();
}

$('#present').click(function() {
  if (presentMode) {
    setupEditMode();
  }
  else {
    setupPresentMode();
  }
});

editor.on('change', function() {
  $('.slides').html('');
  var slides = editor.getValue().split('\n\n---\n\n');
  var slideLines = 0;
  var cursorRow = editor.getCursorPosition().row;
  var revealIdx;
  for (var slideIdx in slides) {
    var slide = slides[slideIdx];
    slideLines += slide.split('\n').length + 3;
    if (revealIdx === undefined && cursorRow < slideLines) {
      revealIdx = slideIdx;
    }
    $('.slides').append('<section data-markdown><script type="text/template">' + filterXSS(slide) + '</script></section>');
  }
  if (typeof Reveal !== undefined && typeof RevealMarkdown !== undefined) {
    RevealMarkdown.convertSlides();
    var currentIdx = Reveal.getIndices();
    revealIdx = revealIdx || currentIdx.h;
    Reveal.sync();
    Reveal.slide(revealIdx, currentIdx.v);
  }
});

function fullscreenChange() {
  if (presentMode && (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement != null)) {
    $('#menubar').hide();
    $('#menubar').css('height', '0');
    $('#preview').css('top', '0');
  }
  else {
    $('#menubar').show();
    $('#menubar').css('height', 'auto');
    $('#preview').css('top', '31px');
  }
}
