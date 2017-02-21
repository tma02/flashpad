prodName = 'Flashslide';

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
  Reveal.slide(currentIdx.h, currentIdx.v);
});
