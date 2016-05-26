'use strict'

const Readable = require('readable-stream').Readable
function noop () {}

function StreamError (error, input, streamIndex, inputs) {
  this.message = error ? error.message || error : 'null-error'
  this.cause = error
  this.input = input
  this.inputs = inputs
  this.streamIndex = streamIndex
}
StreamError.prototype = Object.create(Error)
StreamError.prototype.toString = function () {
  return '[StreamError input#' + this.streamIndex + ' message: ' + this.message + ']'
}

module.exports = function (inputs) {
  if (!Array.isArray(inputs)) {
    throw new TypeError('input-not-array')
  }
  if (inputs.length === 0) {
    return new Readable({
      objectMode: true,
      read: function () {
        this.push(null)
      }
    })
  }

  var sets = {}
  var handlers = []
  var counts = {}
  var ends = 0
  const max = inputs.length
  const close = function (delayError) {
    inputs.forEach(function (input, streamIndex) {
      var handler = handlers[streamIndex]
      if (handler) {
        delete handlers[streamIndex]
        input.stream.removeListener('error', handler.error)
        if (delayError) {
          input.stream.on('error', noop)
          setImmediate(input.stream.removeListener.bind(input.stream, 'error', noop))
        }
        input.stream.removeListener('data', handler.data)
        input.stream.removeListener('end', handler.end)
      }
    })
  }

  const stream = new Readable({
    objectMode: true,
    read: function () {}
  })
  stream.close = function () {
    close()
  }

  inputs.forEach(function (input, streamIndex) {
    if (!input.name) {
      input.name = streamIndex
    }
    if (typeof input.key === 'string' || typeof input.key === 'number') {
      input.key = function (key, item, itemNr) {
        return item[key] || itemNr
      }.bind(null, input.key)
    }
    if (typeof input.key !== 'function') {
      input.key = function (item, itemNr) {
        if (Array.isArray(item)) {
          return item[0]
        }
        return item.key || item.code || item.id || itemNr
      }
    }
    var itemPos = 0
    var handler = {
      error: function (error) {
        close(true)
        stream.emit('error', new StreamError(error, input, streamIndex, inputs))
        stream.emit('end')
      },
      data: function (item) {
        var key = input.key(item, itemPos)
        var result = sets[key]
        var count
        if (!result) {
          result = {
            key: key,
            pos: {},
            data: {}
          }
          sets[key] = result
          count = 1
        } else {
          count = counts[key] + 1
        }
        result.data[input.name] = item
        result.pos[input.name] = itemPos
        itemPos += 1
        if (count === max) {
          stream.push(result)
          delete counts[key]
          delete sets[key]
        } else {
          counts[key] = count
        }
      },
      end: function () {
        ends += 1
        if (ends === max) {
          delete handlers[streamIndex]
          close()
          var missingKeys = Object.keys(sets)
          if (missingKeys.length > 0) {
            stream.emit('missing', missingKeys, sets)
          }
          stream.push(null)
        }
      }
    }
    handlers[streamIndex] = handler
    input.stream.on('error', handler.error)
    input.stream.on('data', handler.data)
    input.stream.on('end', handler.end)
  })

  return stream
}
module.exports.StreamError = StreamError
