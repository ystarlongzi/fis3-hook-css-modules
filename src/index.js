var assign = require('object-assign');
var stringHash = require('string-hash');
var listeners = require('./listeners');

var defaultOptions = {
  mode: 'dep',
  extList: ['.js', '.es', '.es6', '.jsx', '.ts', '.tsx'],
  scope: scopedNameGenerator,
};

function scopedNameGenerator(name, filename, css) {
  var i = css.indexOf('.' + name);
  var lineNumber = css.substr(0, i).split(/[\r\n]/).length;
  var hash = stringHash(css).toString(36).substr(0, 5);

  return [name, hash, lineNumber].join('_');
}


module.exports = function (fis, conf) {
  conf = assign({}, defaultOptions, conf || {});

  var _listeners = listeners(conf);

  // 注册事件
  fis.on('lookup:file', _listeners.lookup);
  fis.on('compile:standard', _listeners.compileStandard);
  fis.on('compile:end', _listeners.compileEnd);
};

module.exports.defaultOptions = defaultOptions;


