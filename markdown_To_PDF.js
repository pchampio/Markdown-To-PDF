convertFile: function (filePath, encoding) {
  var jobInfo = fileInfo = {};

  fileInfo = jobInfo.fileInfo = path.parse(filePath);

  atom.notifications.addInfo('Start converting ' + fileInfo.base);

  jobInfo.exportType = atom.config.get('markdown-themeable-pdf.exportFileType');
  jobInfo.destFileBase = fileInfo.name + '.' + jobInfo.exportType;
  jobInfo.destFile = path.resolve(fileInfo.dir, jobInfo.destFileBase);
  var hljs = require('highlight.js');
  var cheerio = require('cheerio');

  var md = require('markdown-it')({
    html: atom.config.get('markdown-themeable-pdf.enableHtmlInMarkdown'),
    linkify: atom.config.get('markdown-themeable-pdf.enableLinkify'),
    typographer: atom.config.get('markdown-themeable-pdf.enableLinkify'),
    xhtmlOut: atom.config.get('markdown-themeable-pdf.enableXHTML'),
    breaks: atom.config.get('markdown-themeable-pdf.enableBreaks'),
    quotes: atom.config.get('markdown-themeable-pdf.smartQuotes'),
    langPrefix: 'hljs ' + atom.config.get('markdown-themeable-pdf.codeHighlightingTheme').replace(/\./g, '-') + ' ',
    highlight: function (str, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(lang, str).value;
        } catch (err) {
          throw err;
        }
      }
      // if (atom.config.get('markdown-themeable-pdf.codeHighlightingAuto')) {
      //     try {
      //         return hljs.highlightAuto(str).value;
      //     } catch (err) {
      //         throw err;
      //     }
      // }
      return ''; // use external default escaping
    }
  });

  // size-specified image markups
  md.use(require('markdown-it-imsize'), {
    autofill: false
  });

  // checkboxes
  if (atom.config.get('markdown-themeable-pdf.enableCheckboxes')) {
    md.use(require('markdown-it-checkbox'), {
      divWrap: false,
      divClass: 'checkbox',
      idPrefix: 'checkbox-'
    });
  }

  // smart arrows
  if (atom.config.get('markdown-themeable-pdf.enableSmartArrows')) {
    md.use(require('markdown-it-smartarrows'));
  }

  // fix src scheme
  if (jobInfo.exportType != 'html') {
    md.renderer.rules.image = function (tokens, idx, options, env, self) {
      var token = tokens[idx];
      var src = token.attrs[token.attrIndex('src')][1];

      token.attrs[token.attrIndex('src')][1] = markdownThemeablePdf.resolveImgSrc(src, fileInfo.dir);

      return self.renderToken.apply(self, arguments);
    };
    md.renderer.rules.html_block = function (tokens, idx) {
      var $ = cheerio.load(tokens[idx].content);

      $('img').each(function () {
        $(this).attr('src',  markdownThemeablePdf.resolveImgSrc($(this).attr('src'), fileInfo.dir));
      });

      return tokens[idx].content = $.html();
    };
  }

  // innerWrap cells to avoid page break glitches
  if (jobInfo.exportType != 'html') {
    md.renderer.rules.th_open = function () {
      return '<th><div>';
    };
    md.renderer.rules.th_close = function () {
      return '</div></th>';
    };
    md.renderer.rules.td_open = function () {
      return '<td><div>';
    };
    md.renderer.rules.td_close = function () {
      return '</div></td>';
    };
  }

  if (typeof encoding === 'undefined') {
    encoding = atom.config.get('core.fileEncoding');
  }

  fs.readFile(filePath, encoding, function (err, markdown) {

    if (err) {
      atom.notifications.addError('Could not read ' + fileInfo.base + ': ' + err.message);
      throw err;
    }

    try {
      var html = md.render(markdown);
    } catch (err) {
      throw err;
    }

    var cssFile, cssStyles = '';
    cssFile = path.resolve(__dirname, '../css/document.css');
    try {
      cssStyles += fs.readFileSync(cssFile, encoding) + '\n';
    } catch (err) {
      atom.notifications.addWarning('Stylesheet ' + cssFile + ' not found');
      console.error(err);
    }
    cssFile = markdownThemeablePdf.getConfigFilePath(atom.config.get('markdown-themeable-pdf.customStylesPath'), filePath);
    try {
      cssStyles += fs.readFileSync(cssFile, encoding) + '\n';
    } catch (err) {
      atom.notifications.addWarning('Stylesheet ' + cssFile + ' not found');
      console.error(err);
    }
    cssFile = path.resolve(__dirname, '../node_modules/highlight.js/styles', atom.config.get('markdown-themeable-pdf.codeHighlightingTheme'));
    try {
      cssStyles += fs.readFileSync(cssFile, encoding) + '\n';
    } catch (err) {
      atom.notifications.addWarning('Stylesheet ' + cssFile + ' not found');
      console.error(err);
    }

    if (atom.config.get('markdown-themeable-pdf.preWrap')) {
      cssStyles += 'pre { white-space: pre-wrap !important; word-break: break-word !important; overflow: hidden !important;}';
    }

    var customHeader = (function () {
      if (!atom.config.get('markdown-themeable-pdf.enableCustomHeader') || jobInfo.exportType == 'html')
        return {
          height: '0cm',
          html: ''
        };

      var setting = markdownThemeablePdf.getConfigFilePath(atom.config.get('markdown-themeable-pdf.customHeaderPath'), filePath);
      try {
        var obj = require(setting)(jobInfo);

        if (typeof obj !== 'object' ||
            typeof obj.height === 'undefined' ||
            typeof obj.contents === 'undefined') {

          return {
            height: '0cm',
            html: ''
          };
        }

        var $ = cheerio.load(obj.contents);
        var dir = path.dirname(setting);

        $('img').each(function () {
          $(this).attr('src',  markdownThemeablePdf.resolveImgSrc($(this).attr('src'), dir));
        });

        return {
          height: obj.height,
          html: '<header id="pageHeader" class="meta">\n' + $.html() + '\n</header>\n'
        };
      } catch (err) {
        atom.notifications.addWarning('Could not process custom header ' + setting);
        console.error(err);
        return;
      }
    })();
    var customFooter = (function () {
      if (!atom.config.get('markdown-themeable-pdf.enableCustomFooter') || jobInfo.exportType == 'html')
        return {
          height: '0cm',
          html: ''
        };

      var setting = markdownThemeablePdf.getConfigFilePath(atom.config.get('markdown-themeable-pdf.customFooterPath'), filePath);
      try {
        var obj = require(setting)(jobInfo);

        if (typeof obj !== 'object' ||
            typeof obj.height === 'undefined' ||
            typeof obj.contents === 'undefined') {

          return {
            height: '0cm',
            html: ''
          };
        }

        var $ = cheerio.load(obj.contents);
        var dir = path.dirname(setting);

        $('img').each(function () {
          $(this).attr('src',  markdownThemeablePdf.resolveImgSrc($(this).attr('src'), dir));
        });

        return {
          height: obj.height,
          html: '<footer id="pageFooter" class="meta">\n' + $.html() + '\n</footer>\n'
        };
      } catch (err) {
        atom.notifications.addWarning('Could not process custom footer ' + setting);
        console.error(err);
        return;
      }
    })();

    var dom = '<!DOCTYPE html>\n' +
      '<html>\n' +
      '<head>\n<meta charset="UTF-8">\n<title>' + jobInfo.destFileBase + '</title>\n<style>\n' + cssStyles + '\n</style>\n</head>\n' +
      '<body>\n' + customHeader.html + '<div id="pageContent">\n' + html + '\n</div>' + customFooter.html + '</body>\n' +
      '</html>\n';

    if (jobInfo.exportType == 'html') {
      fs.writeFile(jobInfo.destFile, dom, function (err) {
        if (err) {
          atom.notifications.addError('Could not write to ' + jobInfo.destFileBase + ': ' + err.message);
          throw err;
        }

        atom.notifications.addSuccess('File ' + jobInfo.destFileBase + ' was created in the same directory');
      });
    } else {
      var htmlToPdf = require('html-pdf');
      htmlToPdf.create(dom, {
        format: atom.config.get('markdown-themeable-pdf.format'),
        orientation: atom.config.get('markdown-themeable-pdf.orientation'),
        border: atom.config.get('markdown-themeable-pdf.pageBorder'),
        type: jobInfo.exportType,
        quality: atom.config.get('markdown-themeable-pdf.imageQuality'),
        header: customHeader,
        footer: customFooter
      }).toStream(function (err, stream) {
        if (err) {
          atom.notifications.addError(err.message);
          throw err;
        }
        try {
          var dest = fs.createWriteStream(jobInfo.destFile);
          dest.on('error', function (err) {
            if (err) {
              atom.notifications.addError('Could not write to ' + jobInfo.destFileBase + ': ' + err.message);
              throw err;
            }
          });
          dest.on('finish', function () {
            atom.notifications.addSuccess('File ' + jobInfo.destFileBase + ' was created in the same directory');
            if (atom.config.get('markdown-themeable-pdf.openPdfInAtomWorkspace')) {
              setTimeout(function () {
                if (jobInfo.exportType == 'pdf' && !atom.packages.isPackageLoaded("pdf-view")) {
                  atom.notifications.addWarning('Could not open ' + jobInfo.destFileBase + ' file for preview. Please install/activate "pdf-view" package.');
                } else {
                  atom.workspace.open(jobInfo.destFile, {searchAllPanes: true});
                }
              }, 666);
            }
          });
          stream.pipe(dest);
        } catch (err) {
          throw err;
        }
      });
    }

  });
}
