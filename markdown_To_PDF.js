var hljs  = require('highlight.js');

var themeCode = 'github-gist.css'

var args = process.argv.slice(2);

var filepath = args[0];

var md = require('markdown-it')({
  html:         true,        // Enable HTML tags in source
  xhtmlOut:     false,        // Use '/' to close single tags (<br />).
  // This is only for full CommonMark compatibility.
  breaks:       false,        // Convert '\n' in paragraphs into <br>
  langPrefix:   'hljs' + themeCode.replace(/\./g, '-') + ' ',
  // useful for external highlighters.
  linkify:      false,        // Autoconvert URL-like text to links

  // Enable some language-neutral replacement + quotes beautification
  typographer:  true,

  quotes:['«\xA0', '\xA0»', '‹\xA0', '\xA0›'],

  // Highlighter function. Should return escaped HTML,
  // or '' if the source string is not changed and should be escaped externaly.

  //https://highlightjs.org


  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(lang, str).value;
      } catch (__) {}
    }

    return ''; // use external default escaping
  }

});


// size-specified image
md.use(require('markdown-it-imsize'), {
  autofill: false
});

var pdf = require('html-pdf');
var fs = require('fs');
var path = require('path');

try {
  var html = md.render(fs.readFileSync(filepath, 'utf8'));

  var cssFile, cssStyles = '';
  cssFile = path.resolve(__dirname, './css/style.css');
  cssStyles += fs.readFileSync(cssFile, 'utf8') + '\n';

  cssFile = path.resolve(__dirname, './node_modules/highlight.js/styles', themeCode);
  cssStyles += fs.readFileSync(cssFile, 'utf8') + '\n';

  var dom = '<!DOCTYPE html>\n' +
    '<html>\n' +
    '<head>\n<meta charset="UTF-8">\n<title>' + 'PDF'  + '</title>\n<style>\n' + cssStyles + '\n</style>\n</head>\n' +
    '<body>\n' + html + '</body>\n' +
    '</html>\n';
  //console.log(dom);
} catch (err) {
  throw err;
}

var options = {
  format: 'A4',
  border: "0.5cm",
  footer: {
    height: '1.2cm',
    contents: '<footer id="pageFooter" class="meta"></footer><div style="float:left;">Page {{page}}/{{pages}}</div><div style="float:right;">&copy; Copyright Champion Pierre</div>'
  }
  ,
  header: {
  height: "1cm",
  contents: ''
  }
};
pdf.create(dom, options).toFile(filepath.substr(0, filepath.lastIndexOf('.')) + '.pdf', function(err, res) {
  if (err) return console.log(err);
  console.log(res.filename ); // { filename: '/app/businesscard.pdf' }
});
