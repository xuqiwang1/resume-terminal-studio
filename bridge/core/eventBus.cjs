const { EventEmitter } = require("node:events");

function createEventBus() {
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);
  return emitter;
}

module.exports = { createEventBus };
