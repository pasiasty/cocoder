// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
      require('@alasdair/karma-scss-preprocessor'),
      require('node-sass-tilde-importer'),
    ],
    files: [
      { pattern: './node_modules/bootstrap-icons/font/bootstrap-icons.css', included: true, served: true },
      { pattern: './node_modules/bootstrap-icons/font/fonts/*', included: false, served: true },
      { pattern: './src/styles.scss', watched: true,  included: true, served: true },
      {
        pattern: "./node_modules/monaco-editor/**/*", included: false, served: true
      },
    ],
    proxies: {
      "/assets/monaco-editor": "/base/node_modules/monaco-editor",
      // "/vs": "/base/node_modules/monaco-editor/min/vs",
    },
    preprocessors: {
      'src/**/*.scss': ['scss']
    },
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/ui'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Chrome'],
    singleRun: false,
    restartOnFileChange: true,
  });
};
