// Copyright 2015 Amos L. King. See the COPYRIGHT
// file at the top-level directory of this distribution.
//
// Licensed under the
// MIT license
// <LICENSE-MIT or http://opensource.org/licenses/MIT>.
// This file may not be copied, modified, or distributed
// except according to those terms.

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var ledChars = require('./chars');

var I2C_ADDRESS = 0x70;

var turn_on = 0x21;
var HT16K33_BLINK_CMD = 0x80;
var HT16K33_BLINK_DISPLAYON = 0x01;
var HT16K33_BLINK_OFF = 0x00;
var HT16K33_CMD_BRIGHTNESS = 0xE0;
var brightness_level = 15;
var clearBitmap = [
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
];

function Backpack(hardware, callback) {
  var self = this;

  self.hardware = hardware;

  self.i2c = hardware.I2C(I2C_ADDRESS);

  self.i2c.send(new Buffer([turn_on]), self._errorCallback);

  self.i2c.send(new Buffer([HT16K33_BLINK_CMD | HT16K33_BLINK_DISPLAYON | HT16K33_BLINK_OFF , HT16K33_CMD_BRIGHTNESS | brightness_level]), self._errorCallback)

  setImmediate(function emitReady() {
    self.emit('ready');
  });

  if (callback) {
    callback(null, self);
  }
}

Backpack.prototype._errorCallback = function(error) {
  if (error === 1) {
    self.emit('error', error);
  }
}

util.inherits(Backpack, EventEmitter);

Backpack.prototype.clear = function(callback) {
  var self = this;
  self.writeBitmap(clearBitmap);
};

Backpack.prototype._prepareText = function(text) {
  var letters = text.split('');
  var frames = [];

  letters.forEach(function(char, index) {
    frames.push(ledChars.getChar(char).slice());
  });

  return frames;
}

Backpack.prototype.scrollText = function(text, interval) {
  var frames = this._prepareText(text);
  var concatedFrames = Array(8).fill([]);

  for (let index of frames.keys()) {
    for (let line of frames[index].keys()) {
      concatedFrames[line] = concatedFrames[line].concat(frames[index][line]);
      concatedFrames[line].push(0);
    }
  }

  this.scroll(concatedFrames, interval);
}

Backpack.prototype.writeBitmap = function(bitmap, callback) {
  var self = this;

  bitmap.forEach(function(row, index) {
    var rowBuffer = row.slice().reverse();
    rowBuffer.unshift(rowBuffer.pop());
    var rowValue = parseInt(rowBuffer.join(""), 2);
    self.i2c.send(new Buffer([index*2 & 0xFF, rowValue]), self._errorCallback);
  });
}

Backpack.prototype.animate = function(frames, interval) {
  var self = this;

  if (frames.length > 0) {
    self.writeBitmap(frames[0]);
    setTimeout(self._animate(frames.slice(1, frames.length), interval), interval);
  }
}

Backpack.prototype._animate = function(frames, interval) {
  var self = this;
  return function() {
    self.animate(frames, interval);
  }
}

Backpack.prototype.scroll = function(bitmap, interval) {
  var self = this;

  var length = bitmap[0].length;

  var paddedBitmap = [];

  bitmap.forEach(function(row, index) {
      paddedBitmap[index] = row.slice();
      paddedBitmap[index].push.apply(paddedBitmap[index],[0,0,0,0,0,0,0,0]);
      paddedBitmap[index].unshift(0,0,0,0,0,0,0,0);
    });

  var n = 0;
  var writeScroll = function() {
    var currentBitmap = [];

    paddedBitmap.forEach(function(row,index) {
      currentBitmap[index] = row.slice(0,8);
      row.shift();
    });

    self.writeBitmap(currentBitmap);

    n++;
    if(n<=length+8) setTimeout(writeScroll, interval);
  }

  setTimeout(writeScroll, interval);
}

function use(hardware, callback) {
  return new Backpack(hardware, callback);
}

exports.Backpack = Backpack;
exports.use = use;
