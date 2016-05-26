'use strict'

const test = require('tap').test
const path = require('path')
const streamFromArray = require('stream-from-array')
const merge = require('../')
const Readable = require('readable-stream').Readable

function noop () {}

test('example code', function (t) {
  var lines = []
  merge([
    { stream: streamFromArray([['1', 'Martin'], ['2', 'Nikolai']], {objectMode: true}) },
    { stream: streamFromArray([['1', 'Heidegger'], ['2', 'Tesla']], {objectMode: true}) }
  ]).on('data', function (line) {
    lines.push([line.key]
      .concat(line.data[0].slice(1))
      .concat(line.data[1].slice(1))
    )
  }).on('end', function () {
    t.deepEqual(lines, [
      ['1', 'Martin', 'Heidegger'],
      ['2', 'Nikolai', 'Tesla']
    ])
    t.end()
  })
})

test('empty stream', function (t) {
  merge([])
    .on('data', function () {
      t.fail('what data?')
    })
    .on('error', function (e) {
      t.fail(e)
    })
    .on('end', function () {
      t.end()
    })
})

test('non-array error', function (t) {
  t.throws(function () {
    merge('abcd')
  }, TypeError)
  t.end()
})

test('missing should be called if there is a different length in two streams', function (t) {
  var missingCalled = false
  merge([
    { stream: streamFromArray([[1]], { objectMode: true }) },
    { stream: streamFromArray([[1], [2]], { objectMode: true }) }
  ])
    .on('data', function () {})
    .on('missing', function (keys, data) {
      missingCalled = true
      t.deepEqual(keys, [2])
      t.deepEqual(data, {
        2: {
          key: 2,
          pos: {
            1: 1
          },
          data: {
            1: [2]
          }
        }
      })
    })
    .on('end', function () {
      if (!missingCalled) {
        t.fail('missing should have been called')
      }
      t.end()
    })
})

test('merging objects', function (t) {
  var hasData = false
  merge([
    { stream: streamFromArray([{key: 1, b: 'foo'}], { objectMode: true }) },
    { stream: streamFromArray([{code: 1, b: 'bar'}], { objectMode: true }) },
    { stream: streamFromArray([{id: 1, b: 'baz'}], { objectMode: true }) },
    { stream: streamFromArray([{key: 1, code: 2, b: 'tar'}], { objectMode: true }) },
    { stream: streamFromArray([{key: 1, id: 2, b: 'taz'}], { objectMode: true }) },
    { stream: streamFromArray([{code: 1, id: 2, b: 'tam'}], { objectMode: true }) }
  ])
    .on('data', function (data) {
      hasData = true
      t.deepEqual(data, {key: 1, data: [
        {key: 1, b: 'foo'},
        {code: 1, b: 'bar'},
        {id: 1, b: 'baz'},
        {key: 1, code: 2, b: 'tar'},
        {key: 1, id: 2, b: 'taz'},
        {code: 1, id: 2, b: 'tam'}
      ], pos: [
        0, 0, 0, 0, 0, 0
      ]})
    })
    .on('end', function () {
      if (!hasData) {
        t.fail('no data retreived')
      }
      t.end()
    })
})

test('merging objects on special keys', function (t) {
  var hasData = false
  merge([
    { stream: streamFromArray([{key: 1, c: 'hoge', b: 'foo'}], { objectMode: true }), key: 'c' },
    { stream: streamFromArray([{key: 1, c: 'hoge', b: 'bar'}], { objectMode: true }), key: 'c' }
  ])
    .on('data', function (data) {
      hasData = true
      t.deepEqual(data, {
        key: 'hoge',
        pos: [0, 0],
        data: [{key: 1, c: 'hoge', b: 'foo'}, {key: 1, c: 'hoge', b: 'bar'}]})
    })
    .on('end', function () {
      if (!hasData) {
        t.fail('no data retreived')
      }
      t.end()
    })
})

test('merging objects on special key as number', function (t) {
  var hasData = false
  merge([
    { stream: streamFromArray([{key: 1, 1: 'hoge', b: 'foo'}], { objectMode: true }), key: 1 },
    { stream: streamFromArray([{key: 1, 1: 'hoge', b: 'bar'}], { objectMode: true }), key: 1 }
  ])
    .on('data', function (data) {
      hasData = true
      t.deepEqual(data, {
        key: 'hoge',
        pos: [0, 0],
        data: [{key: 1, 1: 'hoge', b: 'foo'}, {key: 1, 1: 'hoge', b: 'bar'}]
      })
    })
    .on('end', function () {
      if (!hasData) {
        t.fail('no data retreived')
      }
      t.end()
    })
})

test('merging with non-aligned keys', function (t) {
  var lines = []
  merge([
    { stream: streamFromArray([[2, 'foo'], [1, 'bar']], {objectMode: true}) },
    { stream: streamFromArray([[1, 'baz'], [2, 'tam']], {objectMode: true}) }
  ]).on('data', function (item) {
    lines.push(item)
  }).on('end', function () {
    t.deepEqual(lines, [
      {
        key: 1,
        pos: [1, 0],
        data: [
          [1, 'bar'],
          [1, 'baz']
        ]
      },
      {
        key: 2,
        pos: [0, 1],
        data: [
          [2, 'foo'],
          [2, 'tam']
        ]
      }
    ])
    t.end()
  })
})

test('merging objects and giving each a name', function (t) {
  var hasData = false
  merge([
    { stream: streamFromArray([[1, 'omni']], { objectMode: true }), name: 'bus' },
    { stream: streamFromArray([[1, 'foo']], { objectMode: true }), name: 'bar' }
  ])
    .on('data', function (data) {
      hasData = true
      t.deepEqual(data, {key: 1, data: {
        bus: [1, 'omni'],
        bar: [1, 'foo']
      }, pos: {
        bus: 0,
        bar: 0
      }})
    })
    .on('end', function () {
      if (!hasData) {
        t.fail('no data retreived')
      }
      t.end()
    })
})

test('handling errors in one stream', function (t) {
  var cause = new Error('fancy cause')
  var errStream = new Readable({
    read: function () {
      this.emit('error', cause)
    }
  })
  var errorInput = { stream: errStream }
  var errorCalled = false
  var inputs = [
    { stream: streamFromArray([[1, 'omni']], {objectMode: true}) },
    errorInput
  ]
  merge(inputs).on('data', function () {
    t.fail('Data should not arrive')
  }).on('error', function (e) {
    t.ok(e instanceof merge.StreamError)
    t.equal(e.cause, cause)
    t.equal(e.message, cause.message)
    t.equal(e.input, errorInput)
    t.equal(e.streamIndex, 1)
    t.equal(e.inputs, inputs)
    t.equal(e.toString(), '[StreamError input#1 message: fancy cause]')
    errorCalled = true
  }).on('end', function () {
    t.ok(errorCalled)
    t.end()
  })
})

test('data after an error should be ignored', function (t) {
  var cause = new Error('fancy cause')
  var persistentStream = new Readable({
    objectMode: true,
    read: noop
  })
  var errStream = new Readable({
    read: function () {
      this.emit('error', cause)
      persistentStream.push({code: 'hi'})
      persistentStream.emit('error', new Error('ignore this'))
    }
  })
  var errorInput = { stream: errStream }
  var errorCalled = 0
  merge([
    { stream: streamFromArray([[1, 'omni']], { objectMode: true }) },
    errorInput,
    { stream: persistentStream }
  ]).on('data', function () {
    t.fail('Data should not arrive')
  }).on('error', function (e) {
    persistentStream.pause()
    errorCalled++
  }).on('end', function () {
    t.equal(errorCalled, 1)
    t.end()
  })
})

test('regular stream should have no listeners if error stream fails', function (t) {
  var count = 0
  var regularStream = new Readable({
    objectMode: true,
    read: function () {
      setImmediate(function () {
        this.push(count += 1)
      }.bind(this))
    }
  })
  var errorCalled = 0
  merge([
    { stream: regularStream },
    { stream: new Readable({
      read: function () {
        this.emit('error', 'ignore this')
      }
    })
    }
  ]).on('data', function () {
    t.fail('Data should not arrive')
  }).on('error', function (e) {
    regularStream.pause()
    errorCalled++
  }).on('end', function () {
    t.equal(count, 0)
    t.equal(errorCalled, 1)
    t.end()
  })
})

test('fallback if error is null', function (t) {
  var errorCalled = false
  merge([{
    stream: new Readable({
      read: function () {
        this.emit('error', null)
      }
    })
  }]).on('error', function (e) {
    t.equal(e.message, 'null-error')
    errorCalled = true
  }).on('end', function () {
    t.ok(errorCalled)
    t.end()
  })
})

test('close should be closing things', function (t) {
  merge([{
    stream: new Readable({
      read: noop
    })
  }, {
    stream: new Readable({
      read: noop
    })
  }])
    .on('data', function () {
      t.fail('Data should not be called')
    })
    .on('error', function () {
      t.fail('Error shouldnt be called')
    })
    .on('missing', function () {
      t.fail('missing shouldnt be called')
    })
    .on('end', function () {
      t.fail('End shouldnt be called')
    })
    .close()
  t.end()
})
