[![ISC License](https://img.shields.io/badge/license-ISC-brightgreen.svg?style=flat)](LICENSE.md)
[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)
[![npm version](https://badge.fury.io/js/stream-merge.svg)](https://badge.fury.io/js/stream-merge)
[![Build Status](https://travis-ci.org/martinheidegger/stream-merge.svg?branch=master)](https://travis-ci.org/martinheidegger/stream-merge)


# stream-merge

Node.js library to flexibly merge two streams based on a key together. 

```javascript
const streamFromArray = require('stream-from-array')
const fs = require('fs')
const merge = require('stream-merge')

var lines = []
merge([
  { stream: streamFromArray([['1', 'Martin'], ['2', 'Nikolai']]) },
  { stream: streamFromArray([['1', 'Heidegger'], ['2', 'Tesla']]) }
]).on('data', (line) => {
  lines.push([line.key]
    .concat(line.data[0].slice(1))
    .concat(line.data[1].slice(1))
  )
}).on('end', () => {
  assert.deepEqual(lines, [
    ['1', 'Martin', 'Heidegger'],
    ['2', 'Nikolai', 'Tesla']
  ])
})
```

## API

`stream-merge` comes with only one method:

```javascript
const merge = require('stream-merge')
```

Its signature is:

```
<readable-stream> = merge( <array-of-streams-sets> )
<readable-stream>.close()
```

where one stream-set is:

```
{
  stream: <stream>,
  [ name: <name of the stream> ],
  [ key: <indentifying one item of the stream> ]
}
```

Here is an example

```javascript
var mergedStream = merge([
  {
    stream: new streamFromArray([['1', 'Martin']]),    // readable stream
    name: 'first',                                     // **optional**, name for this stream
    key: '0'                                           // **optional**, key identifier
  },
  {
    stream: new streamFromArray([['1', 'Heidegger']]), // another stream
    name: 'last',                                      // **optional**, name for this stream
    key: '0'                                           // **optional**, key identifier
  }
  // ...
])
mergedStream.on('data', function (obj) {
  obj == {
    key: '1',                  // identifier for this merged item
    pos: {
      first: 0,                // position of the item in the first stream
      last: 0                  // position of the item in the second stream
    },
    data: {
      first: ['1', 'Martin']   // item from the first stream
      last: ['1', 'Heidegger'] // item from the second stream 
    }
})
mergedStream.on('end', function () {
  // ... done.
})
```

Every item in the list needs to have a `stream` property which is a
[readable-stream](https://github.com/nodejs/readable-stream).
_(Note: that it should be in **objectMode:true**)_
`stream-merge` will add itself as listener to this stream and will match every 
item to a key it receives. Once an item with the same key arrived in every 
stream it will emit a `data` event that contains the item of every stream mapped to a `name`.

The `name` is by default the index of the stream in the array `0, 1, ...`. If 
you want to be a little more explicit about the naming of the streams you can pass in a name.

With `key` you can define which key of the object you would like to use to 
identify the item. You can either define a fixed string or pass-in a function 
that determines the key by itself. The default key lookup is this:


```javascript
function (item) {
  if (Array.isArray(item)) {
    return item[0]
  }
  return item.key || item.code || item.id
}
```

## Error handling

If one of the streams emits an error event `stream-merge` will emit an `error` event.

```javascript
mergeStream.on('error', function (e) {
  e instanceof mergeStream.StreamError
  e.cause // Occurred error
  e.index // index of the stream
  e.input // stream inputSet that had an erro
  e.inputs // All the inputs that were initially passed to the merge-stream
})
```

Additionally it will disconnect itself from all the other streams. To make 
sure that you don't accidentally keep data open you should close the other 
streams as well:

```javascript
merge([
  { stream: ... }
  { stream: ... }
]).on('error', function (e) {
  e.inputs.forEach(function (input, streamIndex) {
    if (streamIndex !== e.index) {
      input.close() // .close is an example! Depending on the read-stream you might
                    // want to cancel it differently.
    }
  })
})
```

## Missing Keys

After all streams have ended it will emit an `end` event. If at that time 
there were items with keys that only existed in one of the streams then it 
will emit a `missing` event

```javascript
mergeStream.on('missing', function (keys, dataSet) {
  keys // Array of keys that have been missing from the output
  dataSet // The already collected raw data
})
```

## Order

The order of the items arriving in `data` is depending on which item first 
contains a full set to merge. If the data of all streams arrive in the same 
order then it is easy to predict the result order. It becomes harder to 
predict if all streams are of different order.

Furthermore: `merge-stream` will need to keep references to all the data that 
is received but not merged yet, so: if the data is not in order, then the RAM 
consumption might become considerably high. 

## Motivation

I have been using this library to merge together multiple csv files based on 
their keys with the problem that each library had a different key. Also I 
wanted the data in-memory to be as little as possible.

## License

ISC
