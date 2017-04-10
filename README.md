fis3-hook-css-modules
=============================

一款基于 fis3 的 [css modules](https://github.com/css-modules/css-modules) 插件。


## 使用

### 安装
```
npm install fis3-hook-css-module
```

### 配置

1. 如果项目中有使用 `Less`、`Sass`，你还需要借助 [fis-parser-less-2.x](https://github.com/fouber/fis-parser-less-2.x)、[fis-parser-node-sass](https://github.com/fex-team/fis-parser-node-sass) 插件。
2. 你或许还需要借助 [fis3-postprocessor-postcss](https://github.com/jiangyuan/fis3-postprocessor-postcss) 插件，完成 css 属性补全等操作
3. 此插件也具有 js-require-css 功能，所以你可能不需要在配置 [fis3-preprocessor-js-require-css](https://github.com/fex-team/fis3-preprocessor-js-require-css)


```js
// 将项目里的 less 文件转换为 css 文件
fis.match('**.less', {
    rExt: '.css',
    parser: fis.plugin('less-2.x'),
});

// 将项目里的 sass 文件转换为 css 文件
fis.match('**.{sass,scss}', {
    rExt: '.css',
    parser: fis.plugin('node-sass'),
});

// 进行 css 属性补全
fis.match('**.{css,less,sass,scss}', {
    postprocessor: fis.plugin('postcss'),
});


// ---- 配置 css modules
fis.hook('css-modules', {
  mode: 'inline',
});
```


## 参数说明
- `mode`：加载模式，默认为 `dep`
    * `dep`
    简单的标记依赖，并将js语句中对应的 `require` 语句去除。fis 的资源加载程序能够分析到这块，并最终以 `<link>` 的方式加载 css。
    
    * `inline` 
    将目标 css/less/scss 文件转换成 js 语句，并直接内嵌在当前 js 中，替换原有 `require` 语句。
    
    * `jsRequire` 
    将目标 css 文件转换成 js 语句，但是并不内嵌，而是产出一份同名的 js 文件，当前 `require` 语句替换成指向新产生的文件。


- `scope`：定义 class 名称生成方式。类型可为 `[function | string]`
    * 当类型为 `function` 时，会接受三个参数
        * `name` 待被转化的 class 名称
        * `file` 当前文件路径
        * `css` 当前文件内容
        
    ```js
    fis.hook('css-modules', {
      scope: function (name, file, css) {
        return (file + '__' + 'name' + '__');
      },
    });
    ```
  
    * 当类型为 `string` 时，可以使用一些标记，如下:
    ```js
    fis.hook('css-modules', {
      scope: '[name]__[local]___[hash:base64:5]',
    });
    ```
    你可以在[这里](https://github.com/webpack/loader-utils#interpolatename)查看这些标记的含义。

- `includePath`: 配置需要 scoped 的文件路径。类型为数组，支持 glob。

- `excludePath`: 配置不需要 scoped 的文件路径。类型为数据，支持 glob。



