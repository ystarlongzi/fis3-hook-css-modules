var deasync = require('deasync');
var css2js = require('fis3-preprocessor-css2js');
var _scopedCore =  require('./scopedCore');

module.exports = function (conf) {
  var lang = fis.compile.lang;
  var scopedCore = _scopedCore(conf);
  var rRequire = /(var\s+\w+\s*=\s*)?\brequire\s*\(\s*('|")(.+?)\2\s*\)/g;

  var mode = conf.mode || 'dep';
  var extList = conf.extList || [];
  var includePath = conf.includePath || [];
  var excludePath = conf.excludePath || [];
  var legalJsFiles = {}, legalCssFiles = {}, everLookupFiles = {};

  /**
   * 匹配并缓存会涉及到 css modules 处理的文件
   */
  function onCompileStart(file) {
    var isLegal;

    if (!file) {
      return false;
    }

    if (everLookupFiles[file.getId()]) {
      if (everLookupFiles[file.getId()].getContent() === file.getContent()) {
        return false;
      }
    }

    // 1. 对路径进行匹配
    if (excludePath.length) {
      excludePath.forEach(function (glob) {
        if (fis.util.glob(glob, file.subpath)) {
          isLegal = false;
        }
      });

      if (isLegal === false) {
        return false;
      }
    }

    if (includePath.length) {
      includePath.forEach(function (glob) {
        if (fis.util.glob(glob, file.subpath)) {
          isLegal = true;
        }
      });

      if (!isLegal) {
        return false;
      }
    }

    // 2. 对后缀进行匹配
    if (extList.length) {
      isLegal = false;

      extList.forEach(function (ext) {
        if (ext.indexOf('.') === -1) {
          ext = '.' + ext;
        }

        if (ext === file.ext) {
          isLegal = true;
        }
      });

      if (!isLegal) {
        return false;
      }
    }

    // 3. 不是 js 类型文件
    else if (!file.isJsLike) {
      return false;
    }

    var rRequire1 = new RegExp(rRequire);
    var rRequire2 = /import\s+(\w+\s+from)?\s*('|")(.+?)\2/g;
    var fileContent = file.getContent();

    [rRequire1, rRequire2].forEach(function (reg) {
      var match;

      while (match = reg.exec(fileContent)) {
        cacheFile(match, file);
      }
    });

    function cacheFile(match, file) {
      // rRequire1.exec('var aa = require("./a/a1");var xx = "oo";');
      // ===>
      // match = ['var aa = require("a1")', 'var aa ', '"', './a/a1'];

      // rRequire2.exec('import aa from "./a/a1";var xx = "oo";');
      // ===>
      // match = ['import aa from "./a/a1"', 'aa from', '"', './a/a1'];
      var targetFile = fis.project.lookup(match[3], file).file;

      if (targetFile) {
        everLookupFiles[file.getId()] = file;

        if (targetFile.isCssLike) {
          legalJsFiles[file.getId()] = {
            file: targetFile,
            _requiredPath: match[3],
          };

          legalCssFiles[targetFile.getId()] = {
            file: file,
            _needScope: !!match[1],
          };
        }
      }
    }
  }

  /**
   * 在 standard 阶段对 css 类型文件进行 css modules 处理, 因为:
   *
   * 1. 该阶段是 fis 内置的一个阶段, 当文件处于 compile 时, 它必然会被触发,
   * 	而其它阶段(parser、preprocessor、postprocessor)未必会被触发
   *
   * 2. 应该尽量在生成 source map 前, 进行 css modules 处理, 否则会影响到 source map
   */

  function onCompileStandard(file) {
    var target;

    // 编译 css 文件
    if (target = legalCssFiles[file.getId()]) {
      compileCss(file, target._needScope);
      return;
    }

    // 编译 js 文件
    if (target = legalJsFiles[file.getId()]) {
      compileJs(file, target.file, target._requiredPath);
      return;
    }
  }

  function compileCss(file, needScope) {
    var fileContent = file.getContent();
    var scopedCss;

    // 考虑向前兼容, 只要存在变量申明时, 才进行 css modules
    if (needScope) {
      scopedCore.load(fileContent, file.url)
      .then(function (obj) {
        scopedCss = obj;
      });

      while (!scopedCss) {
        deasync.sleep(100);
      }
    }
    else {
      scopedCss = {
        injectableSource: fileContent,
      };
    }

    // 更新文件信息及内容
    file.extras = file.extras || {};
    file.extras._scopedCssTokens = scopedCss.exportTokens;
    file.setContent(scopedCss.injectableSource);
  }

  function compileJs(file, cssFile, requiredPath) {
    var _rRequire = new RegExp(rRequire);
    var fileContent = file.getContent();

    fileContent = fileContent.replace(_rRequire, function (str, declare, quote, value) {
      var scopedCss = {};

      if (value != requiredPath) {
        return str;
      }

      fis.compile(cssFile);

      if (cssFile.cache.revert(cssFile)) {
        scopedCss = {
          exportTokens: cssFile.info.extras._scopedCssTokens,
          injectableSource: cssFile.getContent(),
        }
      }

      str = !declare ? '' : (declare + JSON.stringify(scopedCss.exportTokens) + ';');

      switch (mode) {
        case 'dep':
          // 添加依赖标记
          str += '"' + lang.info.wrap(lang.require.wrap(value)) + '"';
          break;

        case 'inline':
          // 添加依赖标记. 否则在更新 css 文件后, 不会触发 livereload
          str += '"' + lang.info.wrap(lang.dep.wrap(value)) + '"';
          str += css2js.processCss(scopedCss.injectableSource);
          break;

        case 'jsRequire':
          var newFile = fis.file.wrap(cssFile.dirname + '/' + cssFile.filename + cssFile.rExt + '.js');

          newFile.setContent(css2js.processCss(scopedCss.injectableSource));
          newFile.isMod = true;
          newFile.moduleId = newFile.id;
          fis.compile(newFile);

          // 其他文件的require中引用的是moduleId，方便从ret.ids中查找到文件，参考deps-pack打包。
          file.extras = file.extras || {};
          file.extras.derived = file.extras.derived || [];
          file.extras.derived.push(newFile);

          str += '"' + lang.info.wrap(lang.dep.wrap(value)) + '"';
          str += 'require(' + quote + (newFile.moduleId || newFile.id) + quote + ')';
          break;
      }
      return str;
    });

    file.setContent(fileContent);

    // 在 `compile:end` 阶段, 需要获取 js 文件的缓存信息
    legalCssFiles[cssFile.getId()].file = file;
  }

  /**
   * 在 css 文件编译结束后, 触发对应的 js 文件进行编译
   */
  function onCompileEnd(file) {
    var target = legalCssFiles[file.getId()];

    if (target && target.file.cache) {
      // 删除缓存, 再次编译 js 文件
      fis.util.del(target.file.cache.cacheInfo);
      fis.util.del(target.file.cache.cacheFile);
      fis.compile(target.file);
    }
  }

  return {
    compileStart: onCompileStart,
    compileStandard: onCompileStandard,
    compileEnd: onCompileEnd,
  };
};
