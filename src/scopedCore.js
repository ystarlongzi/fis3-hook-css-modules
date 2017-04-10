var Core = require('css-modules-loader-core');
var genericNames = require('generic-names');

// class 名称生成器
function getScopedNameGenerator(conf) {
  var generator = conf.scope;

  if (typeof generator === 'function') {
    return generator;
  }

  return genericNames(generator, {
    context: process.cwd()
  });
}

module.exports = function (conf) {
  var scope = Core.scope({
    generateScopedName: getScopedNameGenerator(conf),
  });

  return new Core([
    Core.values,
    Core.localByDefault,
    Core.extractImports,
    scope,
  ]);
};
