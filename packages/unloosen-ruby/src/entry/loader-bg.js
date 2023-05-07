importScripts('/packages/unloosen-ruby/dist/entry/init-bg.esm.js');

main();

// note: remove `Element` from dist/init-bg because Element not defined in Background
// Element.prototype._addEventListener = Element.prototype.addEventListener;