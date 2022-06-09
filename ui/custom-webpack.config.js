module.exports = {
  "resolve": {
    "alias": {
      "vscode": require.resolve("./node_modules/monaco-languageclient/lib/vscode-compatibility")
    },
    "fallback": {
      "path": require.resolve("path-browserify")
    }
  },
}
