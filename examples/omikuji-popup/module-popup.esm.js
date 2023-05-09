var global$1 = (typeof global !== "undefined" ? global :
  typeof self !== "undefined" ? self :
  typeof window !== "undefined" ? window : {});

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init$1 () {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}

function toByteArray (b64) {
  if (!inited) {
    init$1();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders);

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len;

  var L = 0;

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = (tmp >> 16) & 0xFF;
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  if (!inited) {
    init$1();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var output = '';
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[(tmp << 4) & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    output += lookup[tmp >> 10];
    output += lookup[(tmp >> 4) & 0x3F];
    output += lookup[(tmp << 2) & 0x3F];
    output += '=';
  }

  parts.push(output);

  return parts.join('')
}

function read (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
}

var toString$1 = {}.toString;

var isArray = Array.isArray || function (arr) {
  return toString$1.call(arr) == '[object Array]';
};

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var INSPECT_MAX_BYTES = 50;

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
  ? global$1.TYPED_ARRAY_SUPPORT
  : true;

/*
 * Export kMaxLength after typed array support is determined.
 */
kMaxLength();

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }

  return that
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from(this, arg, encodingOrOffset, length)
}

Buffer.poolSize = 8192; // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype;
  return arr
};

function from (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length)
};

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer[Symbol.species] === Buffer) ;
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
};

function allocUnsafe (that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
};

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);

  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }
  return that
}

function fromObject (that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len);
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;

function slowToString (encoding, start, end) {
  var loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true;

function swap (b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer.prototype.toString = function toString () {
  var length = this.length | 0;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer.prototype.equals = function equals (b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
};

Buffer.prototype.inspect = function inspect () {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>'
};

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);

  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (Buffer.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];

  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i]);
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4)
};

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4)
};

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8)
};

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = (value & 0xff);
  return offset + 1
};

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24);
    this[offset + 2] = (value >>> 16);
    this[offset + 1] = (value >>> 8);
    this[offset] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
    this[offset + 2] = (value >>> 16);
    this[offset + 3] = (value >>> 24);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}


function base64ToBytes (str) {
  return toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}


// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
}

function isFastBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
}

/*!
 * @wasmer/wasi
 * Isomorphic Javascript library for interacting with WASI Modules in Node.js and the Browser.
 *
 * @version v1.2.2
 * @author Wasmer Engineering Team <engineering@wasmer.io>
 * @homepage https://github.com/wasmerio/wasmer-js
 * @repository https://github.com/wasmerio/wasmer-js
 * @license MIT
 */
function A$1(A,I,g,B){return new(g||(g=Promise))((function(Q,C){function E(A){try{i(B.next(A));}catch(A){C(A);}}function D(A){try{i(B.throw(A));}catch(A){C(A);}}function i(A){var I;A.done?Q(A.value):(I=A.value,I instanceof g?I:new g((function(A){A(I);}))).then(E,D);}i((B=B.apply(A,I||[])).next());}))}function I$1(A,I){var g,B,Q,C,E={label:0,sent:function(){if(1&Q[0])throw Q[1];return Q[1]},trys:[],ops:[]};return C={next:D(0),throw:D(1),return:D(2)},"function"==typeof Symbol&&(C[Symbol.iterator]=function(){return this}),C;function D(D){return function(i){return function(D){if(g)throw new TypeError("Generator is already executing.");for(;C&&(C=0,D[0]&&(E=0)),E;)try{if(g=1,B&&(Q=2&D[0]?B.return:D[0]?B.throw||((Q=B.return)&&Q.call(B),0):B.next)&&!(Q=Q.call(B,D[1])).done)return Q;switch(B=0,Q&&(D=[2&D[0],Q.value]),D[0]){case 0:case 1:Q=D;break;case 4:return E.label++,{value:D[1],done:!1};case 5:E.label++,B=D[1],D=[0];continue;case 7:D=E.ops.pop(),E.trys.pop();continue;default:if(!(Q=E.trys,(Q=Q.length>0&&Q[Q.length-1])||6!==D[0]&&2!==D[0])){E=0;continue}if(3===D[0]&&(!Q||D[1]>Q[0]&&D[1]<Q[3])){E.label=D[1];break}if(6===D[0]&&E.label<Q[1]){E.label=Q[1],Q=D;break}if(Q&&E.label<Q[2]){E.label=Q[2],E.ops.push(D);break}Q[2]&&E.ops.pop(),E.trys.pop();continue}D=I.call(A,E);}catch(A){D=[6,A],B=0;}finally{g=Q=0;}if(5&D[0])throw D[1];return {value:D[0]?D[1]:void 0,done:!0}}([D,i])}}}let g;const B=new Array(32).fill(void 0);function Q$1(A){return B[A]}B.push(void 0,null,!0,!1);let C$1=B.length;function E$1(A){C$1===B.length&&B.push(B.length+1);const I=C$1;return C$1=B[I],B[I]=A,I}const D=new TextDecoder("utf-8",{ignoreBOM:!0,fatal:!0});D.decode();let i=new Uint8Array;function w$1(){return 0===i.byteLength&&(i=new Uint8Array(g.memory.buffer)),i}function o(A,I){return D.decode(w$1().subarray(A,A+I))}function G$1(A){const I=Q$1(A);return function(A){A<36||(B[A]=C$1,C$1=A);}(A),I}function N(A){const I=typeof A;if("number"==I||"boolean"==I||null==A)return `${A}`;if("string"==I)return `"${A}"`;if("symbol"==I){const I=A.description;return null==I?"Symbol":`Symbol(${I})`}if("function"==I){const I=A.name;return "string"==typeof I&&I.length>0?`Function(${I})`:"Function"}if(Array.isArray(A)){const I=A.length;let g="[";I>0&&(g+=N(A[0]));for(let B=1;B<I;B++)g+=", "+N(A[B]);return g+="]",g}const g=/\[object ([^\]]+)\]/.exec(toString.call(A));let B;if(!(g.length>1))return toString.call(A);if(B=g[1],"Object"==B)try{return "Object("+JSON.stringify(A)+")"}catch(A){return "Object"}return A instanceof Error?`${A.name}: ${A.message}\n${A.stack}`:B}let M=0;const k=new TextEncoder("utf-8"),y$1="function"==typeof k.encodeInto?function(A,I){return k.encodeInto(A,I)}:function(A,I){const g=k.encode(A);return I.set(g),{read:A.length,written:g.length}};function Y$1(A,I,g){if(void 0===g){const g=k.encode(A),B=I(g.length);return w$1().subarray(B,B+g.length).set(g),M=g.length,B}let B=A.length,Q=I(B);const C=w$1();let E=0;for(;E<B;E++){const I=A.charCodeAt(E);if(I>127)break;C[Q+E]=I;}if(E!==B){0!==E&&(A=A.slice(E)),Q=g(Q,B,B=E+3*A.length);const I=w$1().subarray(Q+E,Q+B);E+=y$1(A,I).written;}return M=E,Q}let a=new Int32Array;function h(){return 0===a.byteLength&&(a=new Int32Array(g.memory.buffer)),a}function F$1(A){return null==A}let J$1=new Float64Array;function R(A,I){try{return A.apply(this,I)}catch(A){g.__wbindgen_exn_store(E$1(A));}}function c(A,I){return w$1().subarray(A/1,A/1+I)}function K$1(A,I){const g=I(1*A.length);return w$1().set(A,g/1),M=A.length,g}class U{static __wrap(A){const I=Object.create(U.prototype);return I.ptr=A,I}__destroy_into_raw(){const A=this.ptr;return this.ptr=0,A}free(){const A=this.__destroy_into_raw();g.__wbg_jsvirtualfile_free(A);}lastAccessed(){const A=g.jsvirtualfile_lastAccessed(this.ptr);return BigInt.asUintN(64,A)}lastModified(){const A=g.jsvirtualfile_lastModified(this.ptr);return BigInt.asUintN(64,A)}createdTime(){const A=g.jsvirtualfile_createdTime(this.ptr);return BigInt.asUintN(64,A)}size(){const A=g.jsvirtualfile_size(this.ptr);return BigInt.asUintN(64,A)}setLength(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16);g.jsvirtualfile_setLength(B,this.ptr,A);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}read(){try{const C=g.__wbindgen_add_to_stack_pointer(-16);g.jsvirtualfile_read(C,this.ptr);var A=h()[C/4+0],I=h()[C/4+1],B=h()[C/4+2];if(h()[C/4+3])throw G$1(B);var Q=c(A,I).slice();return g.__wbindgen_free(A,1*I),Q}finally{g.__wbindgen_add_to_stack_pointer(16);}}readString(){try{const D=g.__wbindgen_add_to_stack_pointer(-16);g.jsvirtualfile_readString(D,this.ptr);var A=h()[D/4+0],I=h()[D/4+1],B=h()[D/4+2],Q=h()[D/4+3],C=A,E=I;if(Q)throw C=0,E=0,G$1(B);return o(C,E)}finally{g.__wbindgen_add_to_stack_pointer(16),g.__wbindgen_free(C,E);}}write(A){try{const E=g.__wbindgen_add_to_stack_pointer(-16);var I=K$1(A,g.__wbindgen_malloc),B=M;g.jsvirtualfile_write(E,this.ptr,I,B);var Q=h()[E/4+0],C=h()[E/4+1];if(h()[E/4+2])throw G$1(C);return Q>>>0}finally{g.__wbindgen_add_to_stack_pointer(16),A.set(w$1().subarray(I/1,I/1+B)),g.__wbindgen_free(I,1*B);}}writeString(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16),C=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),E=M;g.jsvirtualfile_writeString(Q,this.ptr,C,E);var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return I>>>0}finally{g.__wbindgen_add_to_stack_pointer(16);}}flush(){try{const I=g.__wbindgen_add_to_stack_pointer(-16);g.jsvirtualfile_flush(I,this.ptr);var A=h()[I/4+0];if(h()[I/4+1])throw G$1(A)}finally{g.__wbindgen_add_to_stack_pointer(16);}}seek(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16);g.jsvirtualfile_seek(Q,this.ptr,A);var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return I>>>0}finally{g.__wbindgen_add_to_stack_pointer(16);}}}class S{static __wrap(A){const I=Object.create(S.prototype);return I.ptr=A,I}__destroy_into_raw(){const A=this.ptr;return this.ptr=0,A}free(){const A=this.__destroy_into_raw();g.__wbg_memfs_free(A);}static __wbgd_downcast_token(){return G$1(g.memfs___wbgd_downcast_token())}constructor(){try{const B=g.__wbindgen_add_to_stack_pointer(-16);g.memfs_new(B);var A=h()[B/4+0],I=h()[B/4+1];if(h()[B/4+2])throw G$1(I);return S.__wrap(A)}finally{g.__wbindgen_add_to_stack_pointer(16);}}static from_js(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16);g.memfs_from_js(Q,E$1(A));var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return S.__wrap(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}readDir(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16),C=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),E=M;g.memfs_readDir(Q,this.ptr,C,E);var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}createDir(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16),Q=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),C=M;g.memfs_createDir(B,this.ptr,Q,C);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}removeDir(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16),Q=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),C=M;g.memfs_removeDir(B,this.ptr,Q,C);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}removeFile(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16),Q=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),C=M;g.memfs_removeFile(B,this.ptr,Q,C);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}rename(A,I){try{const Q=g.__wbindgen_add_to_stack_pointer(-16),C=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),E=M,D=Y$1(I,g.__wbindgen_malloc,g.__wbindgen_realloc),i=M;g.memfs_rename(Q,this.ptr,C,E,D,i);var B=h()[Q/4+0];if(h()[Q/4+1])throw G$1(B)}finally{g.__wbindgen_add_to_stack_pointer(16);}}metadata(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16),C=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),E=M;g.memfs_metadata(Q,this.ptr,C,E);var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}open(A,I){try{const C=g.__wbindgen_add_to_stack_pointer(-16),D=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),i=M;g.memfs_open(C,this.ptr,D,i,E$1(I));var B=h()[C/4+0],Q=h()[C/4+1];if(h()[C/4+2])throw G$1(Q);return U.__wrap(B)}finally{g.__wbindgen_add_to_stack_pointer(16);}}}class s{static __wrap(A){const I=Object.create(s.prototype);return I.ptr=A,I}__destroy_into_raw(){const A=this.ptr;return this.ptr=0,A}free(){const A=this.__destroy_into_raw();g.__wbg_wasi_free(A);}constructor(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_new(Q,E$1(A));var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return s.__wrap(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}get fs(){try{const B=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_fs(B,this.ptr);var A=h()[B/4+0],I=h()[B/4+1];if(h()[B/4+2])throw G$1(I);return S.__wrap(A)}finally{g.__wbindgen_add_to_stack_pointer(16);}}getImports(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_getImports(Q,this.ptr,E$1(A));var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}instantiate(A,I){try{const C=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_instantiate(C,this.ptr,E$1(A),F$1(I)?0:E$1(I));var B=h()[C/4+0],Q=h()[C/4+1];if(h()[C/4+2])throw G$1(Q);return G$1(B)}finally{g.__wbindgen_add_to_stack_pointer(16);}}start(A){try{const Q=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_start(Q,this.ptr,F$1(A)?0:E$1(A));var I=h()[Q/4+0],B=h()[Q/4+1];if(h()[Q/4+2])throw G$1(B);return I>>>0}finally{g.__wbindgen_add_to_stack_pointer(16);}}getStdoutBuffer(){try{const C=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_getStdoutBuffer(C,this.ptr);var A=h()[C/4+0],I=h()[C/4+1],B=h()[C/4+2];if(h()[C/4+3])throw G$1(B);var Q=c(A,I).slice();return g.__wbindgen_free(A,1*I),Q}finally{g.__wbindgen_add_to_stack_pointer(16);}}getStdoutString(){try{const D=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_getStdoutString(D,this.ptr);var A=h()[D/4+0],I=h()[D/4+1],B=h()[D/4+2],Q=h()[D/4+3],C=A,E=I;if(Q)throw C=0,E=0,G$1(B);return o(C,E)}finally{g.__wbindgen_add_to_stack_pointer(16),g.__wbindgen_free(C,E);}}getStderrBuffer(){try{const C=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_getStderrBuffer(C,this.ptr);var A=h()[C/4+0],I=h()[C/4+1],B=h()[C/4+2];if(h()[C/4+3])throw G$1(B);var Q=c(A,I).slice();return g.__wbindgen_free(A,1*I),Q}finally{g.__wbindgen_add_to_stack_pointer(16);}}getStderrString(){try{const D=g.__wbindgen_add_to_stack_pointer(-16);g.wasi_getStderrString(D,this.ptr);var A=h()[D/4+0],I=h()[D/4+1],B=h()[D/4+2],Q=h()[D/4+3],C=A,E=I;if(Q)throw C=0,E=0,G$1(B);return o(C,E)}finally{g.__wbindgen_add_to_stack_pointer(16),g.__wbindgen_free(C,E);}}setStdinBuffer(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16),Q=K$1(A,g.__wbindgen_malloc),C=M;g.wasi_setStdinBuffer(B,this.ptr,Q,C);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}setStdinString(A){try{const B=g.__wbindgen_add_to_stack_pointer(-16),Q=Y$1(A,g.__wbindgen_malloc,g.__wbindgen_realloc),C=M;g.wasi_setStdinString(B,this.ptr,Q,C);var I=h()[B/4+0];if(h()[B/4+1])throw G$1(I)}finally{g.__wbindgen_add_to_stack_pointer(16);}}}let L$1 = class L{static __wrap(A){const I=Object.create(L.prototype);return I.ptr=A,I}__destroy_into_raw(){const A=this.ptr;return this.ptr=0,A}free(){const A=this.__destroy_into_raw();g.__wbg_wasmerruntimeerror_free(A);}static __wbgd_downcast_token(){return G$1(g.wasmerruntimeerror___wbgd_downcast_token())}};function H$1(){const A={wbg:{}};return A.wbg.__wbindgen_object_clone_ref=function(A){return E$1(Q$1(A))},A.wbg.__wbg_crypto_e1d53a1d73fb10b8=function(A){return E$1(Q$1(A).crypto)},A.wbg.__wbg_process_038c26bf42b093f8=function(A){return E$1(Q$1(A).process)},A.wbg.__wbg_versions_ab37218d2f0b24a8=function(A){return E$1(Q$1(A).versions)},A.wbg.__wbg_node_080f4b19d15bc1fe=function(A){return E$1(Q$1(A).node)},A.wbg.__wbindgen_is_string=function(A){return "string"==typeof Q$1(A)},A.wbg.__wbg_require_78a3dcfbdba9cbce=function(){return R((function(){return E$1(module.require)}),arguments)},A.wbg.__wbindgen_string_new=function(A,I){return E$1(o(A,I))},A.wbg.__wbg_call_168da88779e35f61=function(){return R((function(A,I,g){return E$1(Q$1(A).call(Q$1(I),Q$1(g)))}),arguments)},A.wbg.__wbg_msCrypto_6e7d3e1f92610cbb=function(A){return E$1(Q$1(A).msCrypto)},A.wbg.__wbg_newwithlength_f5933855e4f48a19=function(A){return E$1(new Uint8Array(A>>>0))},A.wbg.__wbindgen_is_object=function(A){const I=Q$1(A);return "object"==typeof I&&null!==I},A.wbg.__wbg_get_57245cc7d7c7619d=function(A,I){return E$1(Q$1(A)[I>>>0])},A.wbg.__wbg_call_97ae9d8645dc388b=function(){return R((function(A,I){return E$1(Q$1(A).call(Q$1(I)))}),arguments)},A.wbg.__wbg_self_6d479506f72c6a71=function(){return R((function(){return E$1(self.self)}),arguments)},A.wbg.__wbg_window_f2557cc78490aceb=function(){return R((function(){return E$1(window.window)}),arguments)},A.wbg.__wbg_globalThis_7f206bda628d5286=function(){return R((function(){return E$1(globalThis.globalThis)}),arguments)},A.wbg.__wbg_global_ba75c50d1cf384f4=function(){return R((function(){return E$1(global$1.global)}),arguments)},A.wbg.__wbindgen_is_undefined=function(A){return void 0===Q$1(A)},A.wbg.__wbg_newnoargs_b5b063fc6c2f0376=function(A,I){return E$1(new Function(o(A,I)))},A.wbg.__wbg_instanceof_Function_056d5b3aef8aaa85=function(A){let I;try{I=Q$1(A)instanceof Function;}catch{I=!1;}return I},A.wbg.__wbindgen_memory=function(){return E$1(g.memory)},A.wbg.__wbg_buffer_3f3d764d4747d564=function(A){return E$1(Q$1(A).buffer)},A.wbg.__wbg_new_8c3f0052272a457a=function(A){return E$1(new Uint8Array(Q$1(A)))},A.wbg.__wbg_set_83db9690f9353e79=function(A,I,g){Q$1(A).set(Q$1(I),g>>>0);},A.wbg.__wbg_length_9e1ae1900cb0fbd5=function(A){return Q$1(A).length},A.wbg.__wbg_subarray_58ad4efbb5bcb886=function(A,I,g){return E$1(Q$1(A).subarray(I>>>0,g>>>0))},A.wbg.__wbindgen_is_function=function(A){return "function"==typeof Q$1(A)},A.wbg.__wbindgen_object_drop_ref=function(A){G$1(A);},A.wbg.__wbg_instanceof_Module_09da91721979648d=function(A){let I;try{I=Q$1(A)instanceof WebAssembly.Module;}catch{I=!1;}return I},A.wbg.__wbg_instanceof_Table_aab62205c7444b79=function(A){let I;try{I=Q$1(A)instanceof WebAssembly.Table;}catch{I=!1;}return I},A.wbg.__wbg_get_19328b9e516e0330=function(){return R((function(A,I){return E$1(Q$1(A).get(I>>>0))}),arguments)},A.wbg.__wbg_instanceof_Memory_f1dc0d9a83a9c8ea=function(A){let I;try{I=Q$1(A)instanceof WebAssembly.Memory;}catch{I=!1;}return I},A.wbg.__wbg_get_765201544a2b6869=function(){return R((function(A,I){return E$1(Reflect.get(Q$1(A),Q$1(I)))}),arguments)},A.wbg.__wbg_getPrototypeOf_c046822345b14263=function(){return R((function(A){return E$1(Reflect.getPrototypeOf(Q$1(A)))}),arguments)},A.wbg.__wbg_set_bf3f89b92d5a34bf=function(){return R((function(A,I,g){return Reflect.set(Q$1(A),Q$1(I),Q$1(g))}),arguments)},A.wbg.__wbindgen_debug_string=function(A,I){const B=Y$1(N(Q$1(I)),g.__wbindgen_malloc,g.__wbindgen_realloc),C=M;h()[A/4+1]=C,h()[A/4+0]=B;},A.wbg.__wbindgen_throw=function(A,I){throw new Error(o(A,I))},A.wbg.__wbindgen_rethrow=function(A){throw G$1(A)},A.wbg.__wbindgen_is_symbol=function(A){return "symbol"==typeof Q$1(A)},A.wbg.__wbg_static_accessor_SYMBOL_45d4d15e3c4aeb33=function(){return E$1(Symbol)},A.wbg.__wbindgen_jsval_eq=function(A,I){return Q$1(A)===Q$1(I)},A.wbg.__wbg_newwithbyteoffsetandlength_d9aa266703cb98be=function(A,I,g){return E$1(new Uint8Array(Q$1(A),I>>>0,g>>>0))},A.wbg.__wbindgen_string_get=function(A,I){const B=Q$1(I),C="string"==typeof B?B:void 0;var E=F$1(C)?0:Y$1(C,g.__wbindgen_malloc,g.__wbindgen_realloc),D=M;h()[A/4+1]=D,h()[A/4+0]=E;},A.wbg.__wbg_imports_5d97b92618ae2b69=function(A){return E$1(WebAssembly.Module.imports(Q$1(A)))},A.wbg.__wbg_length_6e3bbe7c8bd4dbd8=function(A){return Q$1(A).length},A.wbg.__wbg_instanceof_Global_6ae38baa556a9042=function(A){let I;try{I=Q$1(A)instanceof WebAssembly.Global;}catch{I=!1;}return I},A.wbg.__wbg_wasmerruntimeerror_new=function(A){return E$1(L$1.__wrap(A))},A.wbg.__wbg_constructor_20fd216941fe9866=function(A){return E$1(Q$1(A).constructor)},A.wbg.__wbindgen_number_get=function(A,I){const B=Q$1(I),C="number"==typeof B?B:void 0;(0===J$1.byteLength&&(J$1=new Float64Array(g.memory.buffer)),J$1)[A/8+1]=F$1(C)?0:C,h()[A/4+0]=!F$1(C);},A.wbg.__wbg_new0_a57059d72c5b7aee=function(){return E$1(new Date)},A.wbg.__wbg_getTime_cb82adb2556ed13e=function(A){return Q$1(A).getTime()},A.wbg.__wbg_getTimezoneOffset_89bd4275e1ca8341=function(A){return Q$1(A).getTimezoneOffset()},A.wbg.__wbg_new_0b9bfdd97583284e=function(){return E$1(new Object)},A.wbg.__wbindgen_bigint_from_u64=function(A){return E$1(BigInt.asUintN(64,A))},A.wbg.__wbg_new_1d9a920c6bfc44a8=function(){return E$1(new Array)},A.wbg.__wbg_new_8d2af00bc1e329ee=function(A,I){return E$1(new Error(o(A,I)))},A.wbg.__wbg_push_740e4b286702d964=function(A,I){return Q$1(A).push(Q$1(I))},A.wbg.__wbindgen_boolean_get=function(A){const I=Q$1(A);return "boolean"==typeof I?I?1:0:2},A.wbg.__wbg_instanceof_Object_595a1007518cbea3=function(A){let I;try{I=Q$1(A)instanceof Object;}catch{I=!1;}return I},A.wbg.__wbg_exports_1f32da4bc6734cea=function(A){return E$1(Q$1(A).exports)},A.wbg.__wbg_exports_4db28c393be16bc5=function(A){return E$1(WebAssembly.Module.exports(Q$1(A)))},A.wbg.__wbindgen_typeof=function(A){return E$1(typeof Q$1(A))},A.wbg.__wbg_isArray_27c46c67f498e15d=function(A){return Array.isArray(Q$1(A))},A.wbg.__wbg_entries_65a76a413fc91037=function(A){return E$1(Object.entries(Q$1(A)))},A.wbg.__wbg_instanceof_Instance_b0fc12339921a27e=function(A){let I;try{I=Q$1(A)instanceof WebAssembly.Instance;}catch{I=!1;}return I},A.wbg.__wbg_new_1c5d2ff1edfe6d73=function(){return R((function(A,I){return E$1(new WebAssembly.Instance(Q$1(A),Q$1(I)))}),arguments)},A.wbg.__wbg_newwithlength_7c42f7e738a9d5d3=function(A){return E$1(new Array(A>>>0))},A.wbg.__wbg_apply_75f7334893eef4ad=function(){return R((function(A,I,g){return E$1(Reflect.apply(Q$1(A),Q$1(I),Q$1(g)))}),arguments)},A.wbg.__wbindgen_function_table=function(){return E$1(g.__wbindgen_export_2)},A.wbg.__wbindgen_number_new=function(A){return E$1(A)},A.wbg.__wbg_bind_10dfe70e95d2a480=function(A,I,g,B){return E$1(Q$1(A).bind(Q$1(I),Q$1(g),Q$1(B)))},A.wbg.__wbg_randomFillSync_6894564c2c334c42=function(){return R((function(A,I,g){Q$1(A).randomFillSync(c(I,g));}),arguments)},A.wbg.__wbg_getRandomValues_805f1c3d65988a5a=function(){return R((function(A,I){Q$1(A).getRandomValues(Q$1(I));}),arguments)},A}function q(A,I){return g=A.exports,d.__wbindgen_wasm_module=I,J$1=new Float64Array,a=new Int32Array,i=new Uint8Array,g}async function d(A){void 0===A&&(A=new URL("wasmer_wasi_js_bg.wasm",import.meta.url));const I=H$1();("string"==typeof A||"function"==typeof Request&&A instanceof Request||"function"==typeof URL&&A instanceof URL)&&(A=fetch(A));const{instance:g,module:B}=await async function(A,I){if("function"==typeof Response&&A instanceof Response){if("function"==typeof WebAssembly.instantiateStreaming)try{return await WebAssembly.instantiateStreaming(A,I)}catch(I){if("application/wasm"==A.headers.get("Content-Type"))throw I;console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n",I);}const g=await A.arrayBuffer();return await WebAssembly.instantiate(g,I)}{const g=await WebAssembly.instantiate(A,I);return g instanceof WebAssembly.Instance?{instance:g,module:A}:g}}(await A,I);return q(g,B)}function Z$1(A){if(!/^data:/i.test(A))throw new TypeError('`uri` does not appear to be a Data URI (must begin with "data:")');var I=(A=A.replace(/\r?\n/g,"")).indexOf(",");if(-1===I||I<=4)throw new TypeError("malformed data: URI");for(var g=A.substring(5,I).split(";"),B="",Q=!1,C=g[0]||"text/plain",E=C,D=1;D<g.length;D++)"base64"===g[D]?Q=!0:(E+=";".concat(g[D]),0===g[D].indexOf("charset=")&&(B=g[D].substring(8)));g[0]||B.length||(E+=";charset=US-ASCII",B="US-ASCII");var i=Q?"base64":"ascii",w=unescape(A.substring(I+1)),o=Buffer.from(w,i);return o.type=C,o.typeFull=E,o.charset=B,o}var b=null,n=function(g,B){return A$1(void 0,void 0,void 0,(function(){return I$1(this,(function(A){switch(A.label){case 0:return null!==b&&!0!==B?[3,3]:g?[3,2]:[4,WebAssembly.compile(Z$1("data:application/wasm;base64,AGFzbQEAAAABowRDYAJ/fwBgAX8AYAJ/fwF/YAN/f38AYAN/f38Bf2AEf39/fwBgAX8Bf2ABfwF+YAV/f39/fwBgBH9/f38Bf2AAAX9gBX9/f39/AX9gBn9/f39/fwBgA39/fwF+YAAAYAZ/f39/f38Bf2AHf39/f39/fwF/YAJ/fgF/YAN+f38Bf2AHf39/f39/fwBgA39/fgF/YAN/fn8AYAd/f39/f35/AX9gCH9/f39/f39/AX9gBn9/f35/fwBgAn5/AX9gA39/fgBgAX8BfGABfgF/YAV/f39+fgF/YAN+fn8BfmAEfn5/fwF+YAZ/f39+fn8Bf2AGf39/fn9/AX9gBH9+f38Bf2ACf34AYAN/fn8Bf2AFf39/fn8AYAV/f35/fwBgAn9/AX5gBH9/f34AYAF8AX9gCX9/f35/f39/fwBgC39/f39/f39+fn9/AX9gCX9/f39/f39/fwF/YAl/f39/f39+fn8Bf2AEf39/fgF/YAl/f39/f39/fn8AYAV/f39+fwF/YA9/f39/f39/f39/f39/f38Bf2AEf39+fgBgC39/f39/f39/f39/AX9gCH9/fn5/f35/AGAEfn5+fwF+YAR/f35/AX9gA35/fgF/YAV/f31/fwBgBH99f38AYAV/f3x/fwBgBH98f38AYAR/fn9/AGAFf39+f38Bf2ABfgBgAn5/AGAJf39/f39/f39/AGAGf39/f35/AGAHf39/fn9+fwF/AuAUSgN3YmcbX193YmluZGdlbl9vYmplY3RfY2xvbmVfcmVmAAYDd2JnHV9fd2JnX2NyeXB0b19lMWQ1M2ExZDczZmIxMGI4AAYDd2JnHl9fd2JnX3Byb2Nlc3NfMDM4YzI2YmY0MmIwOTNmOAAGA3diZx9fX3diZ192ZXJzaW9uc19hYjM3MjE4ZDJmMGIyNGE4AAYDd2JnG19fd2JnX25vZGVfMDgwZjRiMTlkMTViYzFmZQAGA3diZxRfX3diaW5kZ2VuX2lzX3N0cmluZwAGA3diZx5fX3diZ19yZXF1aXJlXzc4YTNkY2ZiZGJhOWNiY2UACgN3YmcVX193YmluZGdlbl9zdHJpbmdfbmV3AAIDd2JnG19fd2JnX2NhbGxfMTY4ZGE4ODc3OWUzNWY2MQAEA3diZx9fX3diZ19tc0NyeXB0b182ZTdkM2UxZjkyNjEwY2JiAAYDd2JnJF9fd2JnX25ld3dpdGhsZW5ndGhfZjU5MzM4NTVlNGY0OGExOQAGA3diZxRfX3diaW5kZ2VuX2lzX29iamVjdAAGA3diZxpfX3diZ19nZXRfNTcyNDVjYzdkN2M3NjE5ZAACA3diZxtfX3diZ19jYWxsXzk3YWU5ZDg2NDVkYzM4OGIAAgN3YmcbX193Ymdfc2VsZl82ZDQ3OTUwNmY3MmM2YTcxAAoDd2JnHV9fd2JnX3dpbmRvd19mMjU1N2NjNzg0OTBhY2ViAAoDd2JnIV9fd2JnX2dsb2JhbFRoaXNfN2YyMDZiZGE2MjhkNTI4NgAKA3diZx1fX3diZ19nbG9iYWxfYmE3NWM1MGQxY2YzODRmNAAKA3diZxdfX3diaW5kZ2VuX2lzX3VuZGVmaW5lZAAGA3diZyBfX3diZ19uZXdub2FyZ3NfYjViMDYzZmM2YzJmMDM3NgACA3diZypfX3diZ19pbnN0YW5jZW9mX0Z1bmN0aW9uXzA1NmQ1YjNhZWY4YWFhODUABgN3YmcRX193YmluZGdlbl9tZW1vcnkACgN3YmcdX193YmdfYnVmZmVyXzNmM2Q3NjRkNDc0N2Q1NjQABgN3YmcaX193YmdfbmV3XzhjM2YwMDUyMjcyYTQ1N2EABgN3YmcaX193Ymdfc2V0XzgzZGI5NjkwZjkzNTNlNzkAAwN3YmcdX193YmdfbGVuZ3RoXzllMWFlMTkwMGNiMGZiZDUABgN3YmcfX193Ymdfc3ViYXJyYXlfNThhZDRlZmJiNWJjYjg4NgAEA3diZxZfX3diaW5kZ2VuX2lzX2Z1bmN0aW9uAAYDd2JnGl9fd2JpbmRnZW5fb2JqZWN0X2Ryb3BfcmVmAAEDd2JnKF9fd2JnX2luc3RhbmNlb2ZfTW9kdWxlXzA5ZGE5MTcyMTk3OTY0OGQABgN3YmcnX193YmdfaW5zdGFuY2VvZl9UYWJsZV9hYWI2MjIwNWM3NDQ0Yjc5AAYDd2JnGl9fd2JnX2dldF8xOTMyOGI5ZTUxNmUwMzMwAAIDd2JnKF9fd2JnX2luc3RhbmNlb2ZfTWVtb3J5X2YxZGMwZDlhODNhOWM4ZWEABgN3YmcaX193YmdfZ2V0Xzc2NTIwMTU0NGEyYjY4NjkAAgN3YmclX193YmdfZ2V0UHJvdG90eXBlT2ZfYzA0NjgyMjM0NWIxNDI2MwAGA3diZxpfX3diZ19zZXRfYmYzZjg5YjkyZDVhMzRiZgAEA3diZxdfX3diaW5kZ2VuX2RlYnVnX3N0cmluZwAAA3diZxBfX3diaW5kZ2VuX3Rocm93AAADd2JnEl9fd2JpbmRnZW5fcmV0aHJvdwABA3diZxRfX3diaW5kZ2VuX2lzX3N5bWJvbAAGA3diZy1fX3diZ19zdGF0aWNfYWNjZXNzb3JfU1lNQk9MXzQ1ZDRkMTVlM2M0YWViMzMACgN3YmcTX193YmluZGdlbl9qc3ZhbF9lcQACA3diZzFfX3diZ19uZXd3aXRoYnl0ZW9mZnNldGFuZGxlbmd0aF9kOWFhMjY2NzAzY2I5OGJlAAQDd2JnFV9fd2JpbmRnZW5fc3RyaW5nX2dldAAAA3diZx5fX3diZ19pbXBvcnRzXzVkOTdiOTI2MThhZTJiNjkABgN3YmcdX193YmdfbGVuZ3RoXzZlM2JiZTdjOGJkNGRiZDgABgN3YmcoX193YmdfaW5zdGFuY2VvZl9HbG9iYWxfNmFlMzhiYWE1NTZhOTA0MgAGA3diZxxfX3diZ193YXNtZXJydW50aW1lZXJyb3JfbmV3AAYDd2JnIl9fd2JnX2NvbnN0cnVjdG9yXzIwZmQyMTY5NDFmZTk4NjYABgN3YmcVX193YmluZGdlbl9udW1iZXJfZ2V0AAADd2JnG19fd2JnX25ldzBfYTU3MDU5ZDcyYzViN2FlZQAKA3diZx5fX3diZ19nZXRUaW1lX2NiODJhZGIyNTU2ZWQxM2UAGwN3YmcoX193YmdfZ2V0VGltZXpvbmVPZmZzZXRfODliZDQyNzVlMWNhODM0MQAbA3diZxpfX3diZ19uZXdfMGI5YmZkZDk3NTgzMjg0ZQAKA3diZxpfX3diaW5kZ2VuX2JpZ2ludF9mcm9tX3U2NAAcA3diZxpfX3diZ19uZXdfMWQ5YTkyMGM2YmZjNDRhOAAKA3diZxpfX3diZ19uZXdfOGQyYWYwMGJjMWUzMjllZQACA3diZxtfX3diZ19wdXNoXzc0MGU0YjI4NjcwMmQ5NjQAAgN3YmcWX193YmluZGdlbl9ib29sZWFuX2dldAAGA3diZyhfX3diZ19pbnN0YW5jZW9mX09iamVjdF81OTVhMTAwNzUxOGNiZWEz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ZW1mc19fX3diZ2RfZG93bmNhc3RfdG9rZW4AoAkJbWVtZnNfbmV3ALUFDW1lbWZzX2Zyb21fanMArwUNbWVtZnNfcmVhZERpcgBrD21lbWZzX2NyZWF0ZURpcgCKAg9tZW1mc19yZW1vdmVEaXIAiwIQbWVtZnNfcmVtb3ZlRmlsZQCMAgxtZW1mc19yZW5hbWUA6wEObWVtZnNfbWV0YWRhdGEAwgEKbWVtZnNfb3BlbgB9GF9fd2JnX2pzdmlydHVhbGZpbGVfZnJlZQD8BBpqc3ZpcnR1YWxmaWxlX2xhc3RBY2Nlc3NlZACwBRpqc3ZpcnR1YWxmaWxlX2xhc3RNb2RpZmllZACxBRlqc3ZpcnR1YWxmaWxlX2NyZWF0ZWRUaW1lALIFEmpzdmlydHVhbGZpbGVfc2l6ZQCzBRdqc3ZpcnR1YWxmaWxlX3NldExlbmd0aACGAxJqc3ZpcnR1YWxmaWxlX3JlYWQApgMYanN2aXJ0dWFsZmlsZV9yZWFkU3RyaW5nAOEBE2pzdmlydHVhbGZpbGVfd3JpdGUAngIZanN2aXJ0dWFsZmlsZV93cml0ZVN0cmluZwCPAhNqc3ZpcnR1YWxmaWxlX2ZsdXNoAOICEmpzdmlydHVhbGZpbGVfc2VlawCUAg9fX3diZ193YXNpX2ZyZWUA/gMId2FzaV9uZXcASgd3YXNpX2ZzAIgDD3dhc2lfZ2V0SW1wb3J0cwBiEHdhc2lfaW5zdGFudGlhdGUA4QMKd2FzaV9zdGFydABdFHdhc2lfZ2V0U3Rkb3V0QnVmZmVyAP4BFHdhc2lfZ2V0U3Rkb3V0U3RyaW5nAP8BFHdhc2lfZ2V0U3RkZXJyQnVmZmVyAIACFHdhc2lfZ2V0U3RkZXJyU3RyaW5nAIECE3dhc2lfc2V0U3RkaW5CdWZmZXIA+wMTd2FzaV9zZXRTdGRpblN0cmluZwCFBBVjYW5vbmljYWxfYWJpX3JlYWxsb2MAqwYSY2Fub25pY2FsX2FiaV9mcmVlAMcIEV9fd2JpbmRnZW5fbWFsbG9jAKEGEl9fd2JpbmRnZW5fcmVhbGxvYwCPBxNfX3diaW5kZ2VuX2V4cG9ydF8yAQAUX193YmluZGdlbl9leG5fc3RvcmUApggfX193YmluZGdlbl9hZGRfdG9fc3RhY2tfcG9pbnRlcgDrCA9f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mMzBADYCrAMgAiAFNgKoAyACKAKAAyEDIAIoAvgCIQUgAiACKAL8AiIENgL8DSACIAQ2AvQNIAIgBTYC8A0gAiAEIANBGGxqIgM2AvgNIAJBkA9qQQFyIQsgAkGUBmohDCACQaAGaiITQQJqIQ4CQAJAA0ACQCADIARHBEAgAiAEQRhqNgL0DSAEKAIEIgcNAQsgAkHwDWoQxAQgAigCzAMiBCACKALQA0EMbGohCUEAIQUCQANAIAQgCUYEQCACKALYAyIFIAIoAtwDQRhsaiEHAkACQAJAAkACQAJAAkADQCAFIAdGBEAgAigCuAMhAyACQQA2ArgDAn8gAwRAIAIoArwDDAELEIYCIQVBBBDXByIDIAU2AgBB3I/BAAshBSACQcgPakIINwMAIAJBwA9qQgA3AwAgAkG4D2pBADYCACACQgA3A7APIAJBsA9qQQQQmAEgAkHgAWoQ8wQgAkGsD2pBkNnBADYCACACQagPakEANgIAIAJCADcDoA8gAiACKQPoATcDmA8gAiACKQPgATcDkA8gAkGoCGogAkGQD2oiBEHAABCSCRogAkEAOgCkCCACQX82AqAIIAQgAkGgCGoQhAUgAigCkA8NAyACQZgPai0AACEMIAIoApQPIQYgAkHwA2ooAgAhBCACQfQDaigCACERIAIoAuQDIQ8gAigC6AMhEyACQdABahDzBCACKQPQASEcIAIpA9gBIR0gAkHAAWoQ8wQgAikDwAEhHiACKQPIASEfIAJB+A5qQZzbwQBBARCbBCACQZoPaiACQYAPaigCADYBACACQeAOakKAgICAwAA3AwAgAkHcDmpBADoAACACQegOakKAgICAMDcDACACQcQOakGQ2cEANgIAIAJBwA5qQQA2AgAgAkG4DmpCADcDACACQbAOaiAfNwMAIAJBqA5qIB43AwAgAkGkDmpBADoAACACIAIpA/gONwGSDyACQQA2AtgOIAJBADYCoA4gAkGQ2cEANgKMDiACQQA2AogOIAJCADcDgA4gAiAdNwP4DSACIBw3A/ANIAJB1A5qIAU2AgAgAkGSDmogAikBkA83AQAgAkGYDmogAkGWD2opAQA3AQAgAkEAOwGQDiACQoAINwPIDiACQQA6APAOIAIgAzYC0A5BDBDXByIFQQA2AgggBUKAgICAEDcCACACQfANaiIDIAZBCGoi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wBEgAkECNgKcDyACQdySwQA2ApgPIAJBAjYCpA8gAkEANgKQDyACQTY2ApQNIAJBNzYCjA0gAiACQYgNajYCoA8gAiACQcARajYCkA0gAiACQaARajYCiA0gAkGgDGogAkGQD2oQzAMgAigCoAwhByACKAKkDCIEDQQLIAJB4ABqIA4oAgAgEygCACAcIAlB+JDBABClBxCoBCACLQBkIQ0gAigCYCIEQaABaigCAEEORgRAIARBCGohFQJAIBsoAgAiFgRAIAJBoAxqIBYgBUEIaigCABCUBQwBCyACQZAPaiIFIAIoAqARIhYoAgQgFigCCBCfASACQaAMaiAFEIkGCyACQZAPaiIFIAIoAqQMIAIoAqgMEJQFIAJBiA1qIBUgBSAdIBQQ5QUgAikDiA1CAVEEQCACQZwPakECNgIAIAJBpA9qQQE2AgAgAkHYkMEANgKYDyACQQA2ApAPIAJBGDYCrBEgAiACQagRajYCoA8gAiACQaAMajYCqBEgAkGYC2ogAkGQD2oQzAMgAkEANgK0CyACKAKgDCACKAKkDBCGCCAEIA0QhwgMDgsgAigCoAwgAigCpAwQhggLIAQgDRCHCCACQZAPaiIFIBEQ+QQgAkHYAGogBUGIkcEAENkEIAItAFwhBSACKAJYIgRBCGogBxDkBSAEIAUQhwggA0EcaiEDDAELCyACQZgLaiACQfANakGIARCSCRogAigCtAsiA0UNCyACQYgKaiACQbALaigCADYCACACIAIpAJkLNwOICyACIAIpA6gLNwOACiACIAJBoAtqKQAANwCPCyACLQCYCyEFIAJBkApqIAJBuAtqQegAEJIJGiACIAIpAI8LNwD/CiACIAIpA4gLNwP4CiACQfgJaiACKQD/CjcAACACIAM2AowKIAIgBToA8AkgAiACKQP4CjcA8QkgAigCsAMhAyACQQA2ArADIAMNAgwDCyACIAItAIkNOgDAESACQZwPakEBNgIAIAJBpA9qQQE2AgAgAkHYk8EANgKYDyACQQA2ApAPIAJBNjYCrBEgAiACQagRajYCoA8gAiACQcARajYCqBEgAkGgDGpBBHIgAkGQD2oQzAMgAkEANgK0CyACIAIpA6gMNwKcCyACIAIoAqQMNgKYCwwJCyACQQA2ArQLIAIgAigCqAw2AqALIAIgBDYCnAsgAiAHNgKYCwwICyACQZAPaiACQfAJaiAGQUBrKAIAIAZBxABqKAIAQQAgAyACKAK0AxCBASACLQCQD0UEQCACIAIpApQPNwPwDSACQfANahDYBgwBCyACQQA2ApQHIAIgAi0AkQ86AIkGIAJBBzoAiAYMAQsgAigCoAMhAyACQQA2AqADAkACQCADBEAgAkGQD2ogAkHwCWogBkFAaygCACAGQcQAaigCAEEBIAMgAigCpAMQgQEgAi0AkA8NASACIAIpApQPNwPwDSACQfANahDYBgsgAigCqAMhAyACQQA2AqgDIAMEQCACQZAPaiACQfAJaiAGQUBrKAIAIAZBxABqKAIAQQIgAyACKAKsAxCBASACLQCQDw0CIAIgAikClA83A/ANIAJB8A1qENgGCwJAIAIoApgDIgMEQCACQfANaiADIAggAkHwCWogAigCnAMoAhQRBQAgAigC9A0NAQsgAkHoCGoiAyACQfAJakGIARCSCRogBiAMEIcIIAJBkA9qIANBiAEQkgkaIAJB8A1qIgMgAkGgCGpByAAQkgkaQdAAQQgQxwciDUKBgICAEDcDACANQQhqIANByAAQkgkaIAIoAswDIQMgAkHQAGogAigC0AMiERCMBSARQQxsIQVBACEEIAIoAlQhCiACKAJQIg8hBgNAIAZFIAQgBUZyRQRAIAJB8A1qIANBBGooAgAgA0EIaigCABCmBSACKQPwDSEcIAQgCmoiCEEIaiACQfgNaigCADYCACAIIBw3AgAgBEEMaiEEIANBDGohAyAGQQFrIQYMAQsLIAJBQGsQswYgAikDSCEcIAIpA0AhHSACQTBqELMGIAIpAzghHiACKQMwIR8gAkEgahCzBiACKQMoISAgAikDICEhIAIoAtgDIQQgAkEYaiACKALcAyIDEIwFIAJBADYCmAggAiACKAIcIgY2ApQIIAIgAigCGCIINgKQCEEAIQUgA0EYbCEHIAMgCEsEQCACQRBqIAJBkAhqQQAgAxD1AiACKAIQIAIoAhQQqQcgAigClAghBiACKAKYCCEFCyAGIAVBDGxqIQMDQCAHBEAgAkEIaiAEKAIIIgYgBEEUaigCACITakEBakEAEJEEIAJBADYC+A0gAiACKQMINwPwDSACQfANaiAEKAIEIAYQ3gYgAigC+A0iBiACKALwDUYEQCACQfANaiELIwBBIGsi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ACAHQcABakEAIAogAyAOQQV0aiAKQQV0IgNrIApB5OvBABC3BSAHKALAASADakEgayEDIAcoAsQBIRACQANAIAYgCmoiDUUNAyAGIAxqRQ0BIBAgDUEBa0sEQCAHQZgEaiINIABBGGoiDykDADcDACAHQZAEaiIRIABBEGoiEykDADcDACAHQYgEaiIWIABBCGoiFSkDADcDACAHIAApAwA3A4AEIA8gA0EYaiIPKQMANwMAIBMgA0EQaiITKQMANwMAIBUgA0EIaiIVKQMANwMAIAAgAykDADcDACAPIA0pAwA3AwAgEyARKQMANwMAIBUgFikDADcDACADIAcpA4AENwMAIANBIGshAyAGQQFrIQYgAEEgaiEADAELCyAOQQF2IAZqQQFrIBBBhOzBABD/AwALIAwgDEH068EAEP8DAAtBACEBCyACIAFrIQADQCABQQAgAEEKSRsEQCAHQagBaiABQQFrIgEgAiAJIAhB8OzBABC3BSAHKAKoASAHKAKsARDLASAAQQFqIQAMAQUgB0GwA2ogASAAEMMFA0AgB0G4AWogBygCtAMiACAHKAK4AyICEMACIAcoArwBIQwgBygCuAFBAUcEQCABIQIMBAsCQAJAAkAgAiAMQQFqIhBLBEAgAiAMSwRAIAAgEEEDdGoiAigCBCEOIAdBsAFqIAIoAgAiFiAAIAxBA3QiFWoiACgCBCIaIAAoAgBqIAkgCEGg7cEAELcFIAcoArABIgMgDkEFdCICaiEAIAMgBygCtAEiBkEFdGohDSAGIA5rIgYgDk8NAiASIAAgBkEFdCICEJIJIgogAmohBiANQSBrIQIDQCAAIANNIAYgCk1yDQQgAiAAQSBrIg0gBkEgayIPIA9BBGooAgAgD0EIaigCACANQQRqKAIAIA1BCGooAgAQqQZB/wFxQf8BRiITGyIRKQMANwMAIAJBGGogEUEYaikDADcDACACQRBqIBFBEGopAwA3AwAgAkEIaiARQQhqKQMANwMAIAYgDyATGyEGIA0gACATGyEAIAJBIGshAgwACwALIAwgAkGQ7cEAEP8DAAsgECACQYDtwQAQ/wMACyACIBIgAyACEJIJIgJqIQYDQCACIAZPIAAgDU9yDQIgAyAAIAIgAEEEaigCACAAQQhqKAIAIAJBBGooAgAgAkEIaigCABCpBkH/AXEiD0H/AUYiERsiCikDADcDACADQRhqIApBGGopAwA3AwAgA0EQaiAKQRBqKQMANwMAIANBCGogCkEIaikDADcDACACIA9B/wFHQQV0aiECIAAgEUEFdGohACADQSBqIQMMAAsACyAAIQMgCiECCyADIAIgBiACaxCSCRogBygCuAMiACAMSwRAIAcoArQDIBVqIgAgDiAaajYCBCAAIBY2AgAgB0GwA2ogEBCHBQwBCwsgDCAAQbDtwQAQ/wMACwALAAsACyAIQQJJDQAgCEEFdCAJakFAaiEDQQEhAANAIAAgCEYNASADIABBAWoiABDLASADQSBrIQMMAAsACwwFCyADIAlqIgAgBykDgAQ3AwAgAEEYaiAGKQMANwMAIABBEGogDCkDADcDACAAQQhqIA4pAwA3AwAgA0EgaiEDIAhBAWohCAwACwALIAdBgARqIAFB0AFqKAIAIAFB1AFqKAIAIAhBPGooAgAgCEFAaygCABC6BCAHKAKIBEUEQCAHLQCABCEADAELQQghAyAHQegCaiAHQYgEaikDACIbNwMAIAcgBykDgAQiHDcD4AIgB0EZOgCgAyAHQYgDaiIAIBs3AwAgByAcNwOAAyAHIAdBoANqNgKQAyAHQYAEaiAHQYADahC5AQJAIActAKAEQQNGBEAgB0GAA2oQ/AZBACEAQQAhBkEAIQkMAQsgB0GYAWoQuAQgBygCmAEhASAHKAKcASICIAdBgARqQTgQlAkhAyAHQQE2AtgEIAcgAzYC1AQgByABNgLQBCAHQcADaiAHQZADaigCADYCACAHQbgDaiAAKQMANwMAIAcgBykDgAM3A7ADQTghA0EBIQADQCAHQYAEaiAHQbADahC5AQJAIActAKAEQQNHBEAgACAHKALQBEcNASAHQdAEahDaAiAHKALUBCECDAELIAdBsANqEPwGIAcoAtAEIgZBCHYhCSACIQMMAgsgAiADaiAHQYAEakE4EJIJGiAHIABBAWoiADYC2AQgA0E4aiEDDAALAAsCQAJAIActAKADIgJBGUcEQCADIAAQ6QUgBkH/AXEgCUEIdHIgAxDjBwwBCyADDQEgBiECCyACEO4HQf8BcSEADAELIAdBzQA6AKADIAcgAzYCjAMgByADIABBOGxqNgKIAyAHIAM2AoQDQQghASAHIAZB/wFxIAlBCHRyNgKAAyAHIAdB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IAstALgBIQAMCwsgCygC0AEhACALKALIASEGIAtBEGogAUFAaygCACABQcQAaigCACALKQO4ASIaIAsoAsABIhhB2I3AABClBxDrBCALKAIUIQMCQAJAAkACQAJAQQEgCygCECIMKAKYASIOQQprIA5BCU0bQQNrDgIAAQMLIAtBuAFqIg4gDEE8aigCACAMQUBrKAIAEIIGIA4gAiAAEI0JDAELIAtBADYCwAEgC0KAgICAEDcDuAEgC0G4AWogAiAAEI0JCyALKALAASEOIAsoArwBIQwgCygCuAEhEiADIAMoAgBBAWs2AgAgC0GcAWogCToAACALQZoBaiAEOgAAIAtBmQFqIA06AAAgCyAKOgCYASALQbgBaiALKAKQASAMIA4gFiALKAKUASgCDBEIACALKAK4ASIDDQEgCy0AvAEQ7gchACASIAwQhgggAEH/AXEhAAwLCyADIAMoAgBBAWs2AgBBHCEADAoLIAsoArwBIQkgC0EKNgLQAiALIA42AtABIAsgDDYCzAEgCyASNgLIASALQQA2AsABIAsgCTYCvAEgCyADNgK4ASALQeACaiIDIAIgABCUBSALQaABaiAPIBAgC0G4AWpBACADEKIBIAstAKABBEAgCy0AoQEhAAwKCyAKQQJyIAogDRsiA0EQciADIAQbIgNBCHIgAyAFGyEMIAtBsAFqKAIAIQQgCykDqAEhByALQQhqIAFBQGsoAgAgAUHEAGooAgAgGiAYQeiNwAAQpQcQqAQgCy0ADCEFIAsoAggiA0GgAWooAgBBDUcNBCALIAA2AqgBIAsgAjYCpAEgCyAGNgKgASALQbgBaiADQQhqIAtBoAFqIAcgBBDlBSADIAUQhwgMCAtBzAAhACAGQQJxRQ0FDAYLIAtBrAFqQQE2AgAgC0G0AWpBATYCACALQcQBakEBNgIAIAtBzAFqQQA2AgAgC0HM48EANgKoASALQQA2AqABIAtBCTYC5AIgC0HgjsAANgLAASALQaiVwgA2AsgBIAtBADYCuAEgCyALQeACajYCsAEgCyALQbgBajYC4AIgC0GgAWpB6I7AABCBBgALIAtBrAFqQQE2AgAgC0G0AWpBATYCACALQcQBakEBNgIAIAtBzAFqQQA2AgAgC0HM48EANgKoASALQQA2AqABIAtBCTYC5AIgC0GwjsAANgLAASAL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IgZBBHRqIgUoAgAiBEcEQCABIARHDQIgASACKAJAIgEgAigC0AEiBEF/c3FHDQIgASAEcUUNASADQgA3AzgMCAsgAiACKALIASAGQQFqTQR/IAIoAswBIAFBACACKALMAWtxagUgBAsgAigCACIEIAEgBEYiBBs2AgAgBEUNASADIAU2AjggAyACKALMASABaiIBNgI8IAUgATYCACAFQQxqKAIAIQEgBUEIaigCACEEIAUoAgQhBSACQYABahDpASAERQ0HIAMgATYCCCADIAQ2AgQgAyAFNgIADAgLIAMoAihBgJTr3ANHDQIgAyACNgIUIAMgA0EgajYCGCADIANBOGo2AhAQgwQiAQRAIAEoAgAhBCABQQA2AgAgBEUEQCADENcFNgJQIANBEGogA0HQAGoiARCbAiABEPgGDAILIARCADcCCCADIAQ2AgAgA0EQaiADEJsCIAEoAgAhBSABIAQ2AgAgAyAFNgJQIANB0ABqEJMIBSADENcFNgJQIANBEGogA0HQAGoiARCbAiABEPgGCwwACwALIANBgJTr3AM2AiggA0HIAGpBADYCACADQUBrQgA3AwAgA0IANwM4A0AgAigCACIBQQF2IghBH3EiBkEfRg0AIAIoAgQhBSABQQJqIQQCQCABQQFxRQRAIAggAigCQCIHQQF2Rg0BIAQgASAHc0E/S3IhBAsgBUUNASACIAQgAigCACIHIAEgB0YbNgIAIAEgB0cNASAGQR5GBEAgBRCUCCIBKALwAyEHIAIgATYCBCACIARBAmpBfnEgB0EAR3I2AgALIANBxABqIgEgBjYCACADIAU2AkAgBUUNBSAFIAEoAgAiAUEEdGoiBhCVCCAGKAIIIQcgBigCBCEEIAYoAgAhCEEAIQIgAUEBaiIBQR9HBEAgBiAGKAIMIgZBAnI2AgwgASECIAZBBHFFDQULQR4gAmsiAUEAIAFBHk0bIQEgAkEEdCAFakEMaiECA0AgAUUEQCAFEH4MBgsgAi0AAEECcUUEQCACIAIoAgAiBkEEcjYCACAGQQJxRQ0GCyABQQFrIQEgAkEQaiECDAALAAsgB0EBcQRAIANBADYCQAwFCyADKAIoQYCU69wDRw0BIAMgAjYCFCADIANBIGo2AhggAyADQThqNgIQEIMEIgEEQCABKAIAIQQgAUEANgIAIARFBEAgAxDX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AgQgABCoCAALQZ62wQBBGSAGQZABakGstcEAQbi2wQAQ6QMACxDGBQALAAsgABCLCCAFRQ0BCyAPIAkQ3wcLIAYoAlghAAsgABCLCAsgBkGwAmokACAHQf8BcQudDgIJfwJ+IwBBsAFrIgMkACADQShqIAEQ+wUgAygCLCEJIAMoAighAQJ/AkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAgRAIANBIGogASACQQAgAxBMQQEhBCADKAIkIQIgAygCIEUNAQwQCyABKQMQQgBSDQFBASEEQYzSwQBB+wAQOCECDA8LIAIQiwggASkDEFANAQsCQAJAIAFBIGpBmNPBABD4ASICRQRAIANB+ABqQQRyQZjTwQBBBhCbBAwBCyACKQMAUA0BIANBgAFqQQA2AgALIANB6ABqIANBhAFqKAIANgIAIAMgAykCfDcDYEGI1MEAQSIQOCECIANB4ABqELQHQQEhBAwOCyADQQAQQyIENgIwQQghBSACQQhqIgYgASgCeBCXBCECIANBITYCeCACKAIQQSEgBBBEIQIgA0EYahDgBiADKAIcIAIgAygCGCIEGyECIAQNASADIAI2AjQgA0H4AGoQ1QcgAyAGIAEoAngQlwQiASgCCCIENgI4IAMgAUEMaigCACIBNgI8AkAgAQ4CBAMACyADIAI2AkQgAyACEC02AlAgA0IANwNIIAMgA0E4ajYCWCADIANBxABqNgJUIANB+ABqIANByABqEPoDIAMoAnhBBkYEQCADQQA2AqgBIANCgICAgIABNwOgAQwFCyADQQhqQQQgA0HQAGoiASgCACICIAMoAkxrIgVBACACIAVPG0EBaiICQX8gAhsiAiACQQRNGxClBCADQYABaiIKKQMAIQwgA0GIAWoiCykDACENIAMoAgghBSADKAIMIgYgAykDeDcDACAGQRBqIA03AwAgBkEIaiAMNwMAIANB8ABqIANB2ABqKAIANgIAIANB6ABqIAEpAwA3AwAgAyADKQNINwNgQRghAUEBIQIDQCADQfgAaiADQeAAahD6AwJAIAMoAnhBBkcEQCACIAVHDQECf0EAIAUgAygCaCIEIAMoAmRrIgdBACAEIAdPG0EBaiIEQX8gBBtqIgQgBUkNABpBBCAFQQF0IgcgBCAEIAdJGyIEIARBBE0bIgdBGGwhCCAHQdaq1SpJQQN0IQQgAyAFBH8gAyAGNgKgASADIAVBGGw2AqQBQQgFQQALNgKoASADQZABaiAIIAQgA0GgAWoQ4AIgAygClAEhBCADKAKQAQRAIAMoApgBDAELIAchBSAEIQZBgYCAgHgLIQggBCAIEKkHDAELIAMgAjYCqAEgAyAGNgKkASADIAU2AqABDAYLIAEgBmoiBCADKQN4NwMAIARBEGogCykDADcDACAEQQhqIAopAwA3AwAgAUEYaiEBIAJBAWohAgwACwALQff4wQBBK0GI08EAEJEFAAsgAhDQASEBIANB+ABqENUHIANBMGoQ1QcMBAsgA0H4AGogBCACEMMBQRgQUCIBRQ0EIAEgAykDeDcDACABQRBqIANBiAFqKQMANwMAIAFBCGogA0GAAWopAwA3AwAgA0EBNgJoIAMgATYCZCADQQE2AmAgA0EQaiADQeAAahCEBCADKAIUIQEgAygCECEFCyADQTRqENUHDAELIAMgA0GgAWoQhAQgAygCBCEBIAMoAgAhBSADQcQAahDVBwsgA0EwahDVByAFRQ0AQQAhAiABRQ0GIAUQfgwGC0EBIQQgASABKAIAIgJBACACQQFHIgIbNgIAIAINAyADIAE2AnggASgCCCEGIAFBDGooAgAhBSABQRBqKAIAIQIgAUEUaigCACEHIANB+ABqELwGIAUhAQJAAkAgBkEBaw4DAAEFAQsgBSACKAIcIgERBwBC0OOG7bzIqJoQUQ0CC0EYEFAiAQ0CCwALIAUgAREHAELQ44btvMiomhBRDQIgAyACNgJ8IAMgBTYCeEGw+8EAQSsgA0H4AGpBtNbBAEGg18EAEOkDAAsgASAHNgIUIAEgAjYCECABIAU2AgwgASAGNgIIIAFCgYCAgBA3AgALIAMgATYCoAEgA0GEAWpBATYCACADQYwBakEBNgIAIANBxNPBADYCgAEgA0EANgJ4IANByQA2AkwgAyADQcgAajYCiAEgAyADQaABaiIFNgJIIANB4ABqIANB+ABqEMwDIAMoAmQiASADKAJoEDghAiADKAJgIAEQhgggBRDvBgwCCyAFKAIEIQIgBSgCACEBIAUQfiABRQ0AIAMgAjYCpAEgAyABNgKgASADQYQBakEBNgIAIANBjAFqQQE2AgAgA0GA1MEANgKAASADQQA2AnggA0E6NgJMIAMgA0HIAGo2AogBIAMgA0GgAWo2AkggA0HgAGogA0H4AGoQzAMgAygCZCIBIAMoAmgQOCECIAMoAmAgARCGCAwBC0EAIQRBAAwBCyACCyEBIAlBADYCACAAIAQ2AgggACABNgIEIAAgAjYCACADQbABaiQAC90OAQF/IwBBIGsiAiQAAn8CQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQCAALQAAQQFrDhgBAgMEBQYHCAkKCwwNDg8QERITFBUWFxgACyACQRRqQQE2AgAgAkEcakEANgIAIAJB5PjAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDBgLIAJBFGpBATYCACACQRxqQQA2AgAgAkHI+MAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMFwsgAkEUakEBNgIAIAJBHGpBADYCACACQbD4wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwWCyACQRRqQQE2AgAgAkEcakEANgIAIAJBnPjAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDBULIAJBFGpBATYCACACQRxqQQA2AgAgAkGI+MAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMFAsgAkEUakEBNgIAIAJBHGpBADYCACACQfT3wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwTCyACQRRqQQE2AgAgAkEcakEANgIAIAJB5PfAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDBILIAJBFGpBATYCACACQRxqQQA2AgAgAkHI98AANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMEQsgAkEUakEBNgIAIAJBHGpBADYCACACQaT3wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwQCyACQRRqQQE2AgAgAkEcakEANgIAIAJBhPfAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDA8LIAJBFGpBATYCACACQRxqQQA2AgAgAkHo9sAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMDgsgAkEUakEBNgIAIAJBHGpBADYCACACQcz2wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwNCyACQRRqQQE2AgAgAkEcakEANgIAIAJBtPbAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDAwLIAJBFGpBATYCACACQRxqQQA2AgAgAkGU9sAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMCwsgAkEUakEBNgIAIAJBHGpBADYCACACQfT1wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwKCyACQRRqQQE2AgAgAkEcakEANgIAIAJB3PXAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDAkLIAJBFGpBATYCACACQRxqQQA2AgAgAkG89cAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMCAsgAkEUakEBNgIAIAJBHGpBADYCACACQaT1wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwHCyACQRRqQQE2AgAgAkEcakEANgIAIAJBiPXAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDAYLIAJBFGpBATYCACACQRxqQQA2AgAgAkHs9MAANgIQIAJBqJXCADYCGCACQQA2AgggASgCACABQQRqKAIAIAJBCGoQ5gQMBQsgAkEUakEBNgIAIAJBHGpBADYCACACQdz0wAA2AhAgAkGolcIANgIYIAJBADYCCCABKAIAIAFBBGooAgAgAkEIahDmBAwECyACQRRqQQE2AgAgAkEcakEANgIAIAJBxPTAADYCECACQaiVwgA2AhggAkEANgIIIAEoAgAgAUEEaigCACACQQhqEOYEDAMLIAJBFGpBATYCACACQRxqQQA2AgAg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aw4ECQkBAAELIAEQ8AENBwsgAiAFTw0ACwwDCyAERQ0BIAFBHWohCANAAkAgAkH/AXEiBEECRwRAIARBAWsNBgwBCyAFAn8gASgCBCICRQRAIAhBAToAAEEBDAELIANBIGogARCnASADKAIgIQQgA0EQaiAJQQhqKQAANwMAIANBF2ogCUEPaigAADYAACADIAkpAAA3AwggAiAEayEGIAIgBEkNDCADKQIkIQ8gAy0ALCECIAEgBjYCBCACQf8BcUEKRw0NQQILIgJNDQEMBAsLIAFBHWpBADoAAAsgASgCBCIGQQFrIQQgBgRAIABBBjoACCABIAQ2AgQMDQsgBEEAQazJwAAQzQgACyABQR1qIQQDQAJAAkACQCACQf8BcUEBaw4CAQAFCyABKAIEIgJFBEBBASECIARBAToAAAwCCyADQSBqIAEQpwEgAygCICEIIANBEGogCUEIaikAADcDACADQRdqIAlBD2ooAAA2AAAgAyAJKQAANwMIIAIgCGshBiACIAhJDQogAykCJCEPIAMtACwhAiABIAY2AgQgAkH/AXFBCkcNC0ECIQIMAQtBACECIARBADoAACAKQQdxIgZBB0YNBQJAIAZBA2sOBAYGAQABCyABEPABDQQLIAIgBU8NAAsLIABBCjoACAwKCyAKQQZGDQgCQAJAIActAABBAWsOBQQGAAEGBQsgBygCCEF8Rg0JDAULIAcoAgggBygCECIEQQFqQQAgBBtqQX5GDQgMBAsgASgCBCIGQQFrIQQgBkUNBiAAQQc6AAggASAENgIEDAgLIABBBjoACAwHCyAHKAIIIAcoAhAiBEEBakEAIAQbakEIag0BDAULIAcoAghBfEYNBAsgACAKOgAIIAFBHWpBAzoAACAAIAEpAgA3AgAgACABQQlqKQAANwAJIABBEWogAUERaikAADcAACAAQRhqIAFBGGooAAA2AAAMBAsgBiACQZzJwAAQzQgACyAAIAI6AAggACAPNwIAIAAgAykDCDcACSAAQRFqIANBEGopAwA3AAAgAEEYaiADQRdqKAAANgAADAILIARBAEG8ycAAEM0IAAsgAEEKOgAIIAFBHWpBAzoAAAsgA0FAayQAC/oNAgp/AX4jAEHAA2siAyQAIAApAwAhDSABQdjmwQAQzwchASADIAI2AlAgAyAANgJIIAMgATYCQCADIA03AzggA0GIAmoiACADQThqEKMDIAMoAkgQjwQgA0GgAmooAgAhCyADKAKcAiEBIAMoApgCIQUgAygCkAIQiwggACAFQfAAaiIAIAIQlQMCQAJAIAMtAIgCDQAgAyACNgJcIANBiAJqIAAgAhDvAyADLQCIAg0AIAMpA5ACIQ0gAyADQZgCaigCACIANgKQAiADIA03A4gCAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkAgAUE4aigCACABQTxqKAIAIA0gABCsBSICRQRAIAFBGGooAgBFDQEgASkDACABQQhqKQMAIA0gABDeAyENIAMgA0GIAmo2ArgDIAMgAUEQaiIANgJkIAAoAgAhACADIANBuANqNgJgIANBMGogACABQRxqIgAoAgAgDSADQeAAakHtABCYAyADKAIwRQ0BIAAoAgAiAEUNASAAIAMoAjRB6H1sakGIAmshAgsgAi0AhAIhCCADQShqIAIQqAQgAygCKCIAQQhqIQRBAiECIAMtACwhB0EBIABBoAFqKAIAIgZBCmsgBkEJTRtBAWsOBwECAw8ODgUEC0EIIQIMEAsgA0GMAWpBADYCACADQfgBakEJNgIAIANBAjsBYCADQYgCaiICIARBqAEQkgkaIAQgA0HgAGoiAUGoARCSCRogASACQagBEJIJGiABENUBDAMLIANBiAJqIgEQ5AQgAyADKAKMAiIFNgK0AyADIAMoAogCIgg2ArADIANBkAJqEMkBIAEQ5AQgA0GUAmooAgAhBiADKAKQAiEJIAEQhwIgASAAQSRqEOYIIAMoAogCDQMgA0GQAmoiAS0AACEKIAMoAowCIgIpAgQhDSACQQhqIAY2AgAgAiAJNgIEIAMgDTcDuAMgAiAKEP8HIANBiAJqIABBGGoQ5gggAygCiAINBCABLQAAIQYgAygCjAIiAikCBCENIAJBCGogBTYCACACIAg2AgQgAyANNwOwAyACIAYQ/wcgASAEQQhqKQIANwMAIABBFGpBADYCACADIAQpAgA3A4gCIAMoApQCIgEEQCADQZACaiADKAKIAiADKAKMAiABKAIIEQMACyADQbgDahDJASADQbADahCHAgwCCyADQSBqIABBxABqKAIAIABByABqKAIAEOsDIAMoAiAiBEUNCiADQYgCaiICIAQgAygCJBCfASADQeAAaiACENIGIAIQmQcgAEEoaikDAEIBUg0JIABBOGooAgAhAiAAQTBqKQMAIQ0gACAHQQBHEJUJIANBGGogAUE4aigCACABQTxqKAIAIA0gAkHQoMEAEKUHEKgEIAMoAhgiB0GgAWooAgBBDWtBAk8NBCADLQAcIQYgA0GIAmoiACAFQaABahDICCADQRBqIABBvKHBABDYBCADLQAUIQEgACADKAIQIgBBCGogA0HcAGoQ5QIgAykDiAJQDQUgACABEIcIIAhFDQcgB0EIaiEEIANBiAJqIgAgBUHYAWoiBRDjBiADQQhqIQIjAEEQayIBJAACQCAAKAIARQRAIAIgACkCBDcDACABQRBqJAAMAQsgASAAKQIENwMIQbD7wQBBKyABQQhqQYiNwQBB3KHBABDpAwALIAMoAgwhACADKAIIIgEoAghBAnQhCCABKAIEIQlBACECIAMoAlwhCkEAIQECQANAIAIgCEYNASACIAlqIQwgAkEEaiECIAFBAWohASAMKAIAIApHDQALIAAgACgCAEEBazYCACADQYgCaiIAIAQgA0HgAGoQvgIgACAFEPkEIAMgAEHsocEAENkEIAMoAgAiAEEQaigCACIEIAFBAWsiBU0NByADLQAEIQUgAEEMaigCACACaiICQQRrIAIgBCABa0ECdBCUCRogACAEQQFrNgIQIAAgBRCHCAwICyAAIAAoAgBBAWs2AgAMBwsgACkDCCENIABBADYCCCADIA03A4gCIANBiAJqENgGCyAAIAcQhwgMBgsgAyADKAKMAjYCYCADIANBkAJqLQAAOgBkQbD7wQBBKyADQeAAakHEt8EAQZC5wQAQ6QMACyADIAMoAowCNgJgIAMgAS0AADoAZEGw+8EAQSsgA0HgAGpB1LfBAEGgucEAEOkDAAtBpKHBAEGsocEAEJIFAAtB9/jBAEErQcyhwQAQkQUACyAFIARB/KHBABCABAALIAcgBhCHCCADKAJgIAMoAmQQhggLQQAhAgwECyADKAJgIAMoAmQQhggLQRwhAgsgACAHEIcIDAELIAMtAIkCIQILIAsgCygCAEEBazYCACADQcADaiQAIAJB/wFxC8sOAg1/A34jAEHwAWsiAyQAIANBOGogARD7BSADKAI8IQ0gAygCOCELAn8CQAJAIAIQ8ggEQCADQeAAakEANgIAIAMgAjYCWCADQQA2AkQgA0GoAWogCyACEJoCIAMoAqgBIQogAygCxAEiAUUNASADQfwAaiADQbwBaikCADcCACADQfQAaiADQbQBaikCADcCACADIAMpAqwBNwJsIAMgATYChAEgAyAKNgJoIAtBiAFqEOwHIAtBATYCiAEgC0GMAWogA0FAa0EoEJIJGhA1IQogA0GIAWogA0HoAGoQngUgA0EoahDzBCADQbgBaiEBQZDZwQAhAiADKQMwIRAgAykDKCERA0AgA0EgaiADQYgBahCABwJAAkAgAygCICIGBEAgAygCJCEMIAMgAjYCxAEgAyAHNgLAASADIAU2ArwBIAMgBDYCuAEgAyAQNwOwASADIBE3A6gBIAMgDDYCzAEgAyAGNgLIASAGKAIEIQIgAyAGKAIIIgQ2AtwBIAMgAjYC2AEgESAQIAIgBBC6ASEQIAMgA0HYAWo2AuQBIAMgATYC7AEgAyADQeQBajYC6AEgA0EYaiADKAK4ASADKALEASAQIANB6AFqQTkQmAMgAygCGEEAIAMoAsQBIgIbDQEgAygCvAFFBEAjAEHQAGsiAiQAIAIgA0GoAWo2AgggAUEIaigCACEFIAIgAkEIajYCDAJAAkAgBUEBaiIEBEAgASgCACIHIAdBAWoiDkEDdkEHbCAHQQhJGyIHQQF2IARJBEAgAkEoaiAFQRQgBCAHQQFqIgUgBCAFSxsQ+wIgAigCNCIFRQ0CIAIgAikDODcDICACIAU2AhwgAiACKQIsNwIUIAIgAigCKCIPNgIQQWwhB0EAIQQDQCAEIA5GBEAgASkCACERIAEgAikDEDcCACACQRhqIgQpAwAhEiAEIAFBCGoiBCkCADcDACAEIBI3AgAgAiARNwMQIAJBEGoQ5gYMBQsgASgCDCIIIARqLAAAQQBOBEAgAiAPIAUgAkEMaiABIAQQ/wUQ1QYgBSACKAIAQX9zQRRsaiIJIAcgCGoiCCkAADcAACAJQRBqIAhBEGooAAA2AAAgCUEIaiAIQQhqKQAANwAACyAEQQFqIQQgB0EUayEHDAALAAsgASACQQxqQTtBFBCgAQwCCxDIBQALIAIoAiwaCyACQdAAaiQAIAMoAsQBIQILIAMpA9gBIREgA0EQaiADKAK4ASACIBAQ1QYgAy0AFCEFIAMoAsQBIAMoAhBBbGxqIgJBFGsiBEEANgIQIARCgICAgMAANwIIIAQgETcCACADIAMoAsABQQFqNgLAASADIAMoArwBIAVBAXFrNgK8AQwCCyAEQQFqIQEgAikDACEQIAMgBAR/IAIgAUEUbEEHakF4cSIGayEFIAQgBmpBCWohBEEIBUEACzYC0AEgAyAENgLMASADIAU2AsgBIAMgBzYCwAEgAyACNgK4ASADIAEgAmo2ArQBIAMgAkEIajYCsAEgAyAQQn+FQoCBgoSIkKDAgH+DNwOoAQNAAkAgA0GoAWoQ1QMiAgRAIAJBFGsiASgCACIHDQELAkAgAygCwAFFDQADQCADQagBahDVAyIBRQ0BIAFBFGsiAUEIaigCACABQQxqKAIAEM4HDAALAAsCQCADKALQAUUNACADKALMAUUNACADKALIARB+CyADQfgAahDWA0EAIQJBAAwICyABQQxqKAIAIQQgAUEIaigCACEMIAFBBGooAgAhCSACQQRrKAIAQQxsIQEQNSEGIAQhAgNAAkAgAQRAIAIoAgAiCA0BCyAMIAQQzgcgAyAHIAkQByIBNgLYASADIAY2AugBIANBiAFqIAogASAGEPAEIAMtAIgBIAMoAowBQdTxwQBBLkGE8sEAEOoFIANB6AFqENUHIANB2AFqENUHDAILIAIoAgghBSADIAggAigCBBAHIgg2AtgBIANBCGogBSkDACAFQRBqKAIAELEHIAMgAygCCCADKAIMIAsoAngQkAQoAgAQACIFNgLoASADQYgBaiAGIAggBRDwBCADLQCIASADKAKMAUG08MEAQTBBxPHBABDqBSABQQxrIQEgAkEMaiECIANB6AFqENUHIANB2AFqENUHDAALAAsACyACIAMoAhxBbGxqIQILIAZBFGooAgAhBSAGQRBqKAIAIQcgAkEUayIJQRBqIgYoAgAiBCAJQQhqIgkoAgBGBEAgCSAEEP4CIAYoAgAhBAsgAkEIaygCACAEQQxsaiICIAw2AgggAiAFNgIEIAIgBzYCACAGIAYoAgBBAWo2AgAgAygCxAEhAiADKALAASEHIAMoArwBIQUgAygCuAEhBCADKQOwASEQIAMpA6gBIREMAAsAC0G3zsEAQc8AEDghCiACEIsIDAELIANBQGsQ+gULIAohAkEBCyEBIA1BADYCACAAIAE2AgggACACNgIEIAAgCjYCACADQfABaiQAC8ML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IAcgBSACIARBGGoQiQEgBC0AMEUEQCAEIAU2AhQgASgCBCICIAVJDQMgASACIAVrNgIEIAEgASgCACAFajYCACAAQQA6AAAgACAFNgIEDAQLIAQtADEhASAAQQE6AAAgACABOgABDAMLIABBgTo7AQAgBSAKENwGDAILIAQgBC0AIDoANCAEIAQoAhw2AjBBsPvBAEErIARBMGpB8N/BAEH42cEAEOkDAAsgBEE8akE1NgIAIARBJGpBAjYCACAEQSxqQQI2AgAgBEHY4MEANgIgIARBADYCGCAEQTU2AjQgBCACNgIIIAQgBEEwajYCKCAEIARBCGo2AjggBCAEQRRqNgIwIARBGGpBxOHBABCBBgALIARBQGskAAvBBQEHfyMAQdAAayIDJAAgAS0ABCEFIAFBAjoABAJAAkACQAJAIAVBAkcEQCABKAIAIQQgASgAECEGIAEoAAwhByABKAAIIQEgA0GAAjsBICADQQA2AgwgAigCACIIIAgoAgAiCUEBajYCACAJQQBIDQEgAyAINgJAIAMgATYCOCADIANBCGo2AjwgBEEcaiADQThqEI0FIARBBGoQnQIgBCAFEPkHAkACQAJAAkACQCACIAcpAwAgBygCCBCXBkEBaw4DAwIBAAtBhPrBAEEoQcywwQAQkQUACyADQQhqIgEQ5QggA0EANgI8IAEgA0E4ahDRBSADKAI8RQ0FIAAgAykDODcCACAAQRBqIANByABqKQMANwIAIABBCGogA0FAaykDADcCAAwCCyADQThqIAYQ+gQgAygCOARAIAMgAygCPDYCKCADIANBQGstAAA6ACxBsPvBAEErIANBKGpBzK/BAEGssMEAEOkDAAsgA0FAayICLQAAIQQgA0E4aiADKAI8IgVBHGogARDfBCADKAJARQ0GIANBMGoiASACKAIANgIAIAMgAykDODcDKCABEPgGIAUgBBD5ByAAQQA2AgQgAEEBOgAADAELIANBOGogBhD6BCADKAI4BEAgAyADKAI8NgIoIAMgA0FAay0AADoALEGw+8EAQSsgA0EoakHMr8EAQbywwQAQ6QMACyADQUBrIgItAAAhBCADQThqIAMoAjwiBUEcaiABEN8EIAMoAkBFDQQgA0EwaiIBIAIoAgA2AgAgAyADKQM4NwMoIAEQ+AYgBSAEEPkHIABBADYCBCAAQQA6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AiggAiACNgIgIAEoAgAgACACQQhqEOYEDAYLIAJBLGpBATYCACACQTRqQQE2AgAgAkH81sAANgIoIAJBADYCICACQRw2AgwgAiAANgI8IAFBBGooAgAhACACIAJBCGo2AjAgAiACQTxqNgIIIAEoAgAgACACQSBqEOYEDAULIAAgARChAwwECyACIAA2AjwgAkEsakEBNgIAIAJBNGpBATYCACACQfjawAA2AiggAkEANgIgIAJBIDYCDCABQQRqKAIAIQAgAiACQQhqNgIwIAIgAkE8ajYCCCABKAIAIAAgAkEgahDmBAwDCyACQSxqQQE2AgAgAkE0akEANgIAIAJB0NrAADYCKCACQaiVwgA2AjAgAkEANgIgIAEoAgAgAUEEaigCACACQSBqEOYEDAILIABBGGogARCuAQwBCyACQSxqQQI2AgAgAkE0akEBNgIAIAJBmNrAADYCKCACQQA2AiAgAkEcNgIMIAIgADYCPCABQQRqKAIAIQAgAiACQQhqNgIwIAIgAkE8ajYCCCABKAIAIAAgAkEgahDmBAshACACQUBrJAAgAAuiBQEHfyMAQTBrIgMkACABLQAEIQUgAUECOgAEAkACQAJAAkAgBUECRwRAIAEoAgAhBCABKAAQIQYgASgADCEHIAEoAAghASADQYACOwEMIANBADYCBCACKAIAIgggCCgCACIJQQFqNgIAIAlBAEgNASADIAg2AiggAyABNgIgIAMgAzYCJCAEQRxqIANBIGoQjQUgBEEEahCdAiAEIAUQ+QcCQAJAAkACQAJAIAIgBykDACAHKAIIEJcGQQFrDgMDAgEAC0GE+sEAQShBzLDBABCRBQALIAMQ4wggAygCBCEBIANBADYCBCABRQ0FIAMoAgAhAiAAIAMoAgg2AgggACABNgIEIAAgAjYCAAwCCyADQSBqIAYQ+gQgAygCIARAIAMgAygCJDYCECADIANBKGotAAA6ABRBsPvBAEErIANBEGpBzK/BAEGssMEAEOkDAAsgA0EoaiICLQAAIQQgA0EgaiADKAIkIgVBHGogARDfBCADKAIoRQ0GIANBGGoiASACKAIANgIAIAMgAykDIDcDECABEPgGIAUgBBD5ByAAQQA2AgQgAEEBOgAADAELIANBIGogBhD6BCADKAIgBEAgAyADKAIkNgIQIAMgA0Eoai0AADoA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aigCACIAIAAoAgBBAWs2AgAMAQsgAygCDCEHIAMgASAGEOsDIAMoAgAiBkUEQEEOIQAMAwsgA0EQaiAGIAMoAgQQhQUgA0EgaiAEIAAgBxDyAyADLQAgBEAgAy0AISEADAILIANBIGogBCADKAIkIgAgA0EQahDbAgJAIAMoAiAiBEECRwRAIAQNAUEBIQAMAwsgAy0AJCEADAILIAMoAighBCADKAIkIQcgAygCECADKAIUEIYIIAIgARCGCCAFIAUoAgBBAWs2AgAgA0EgaiAIEKcEIANBKGotAAAhAiADKAIkIQEgAygCIEUEQCADQSBqIgUgAUEIaiAEQeDqwAAQ5AIgBRDqBCABQRRqKAIAIAFBGGooAgAgACAHEO0DIQAgASACEMwEDAULIAEgAhDFBwtBBCEADAMLIAMoAhAgAygCFBCGCAsgAiABEIYICyAFIAUoAgBBAWs2AgALIANB8ABqJAAgAAvlAwEGfyMAQTBrIgQkAAJAAkACQAJAAkACQAJAAkAgAUEMaigCACICBEAgASgCCCEFIAJBAWtB/////wFxIgJBAWoiA0EHcSEGAn8gAkEHSQRAQQAhAyAFDAELIAVBPGohAiADQfj///8DcSEHQQAhAwNAIAIoAgAgAkEIaygCACACQRBrKAIAIAJBGGsoAgAgAkEgaygCACACQShrKAIAIAJBMGsoAgAgAkE4aygCACADampqampqamohAyACQUBrIQIgB0EIayIHDQALIAJBPGsLIQIgBgRAIAJBBGohAgNAIAIoAgAgA2ohAyACQQhqIQIgBkEBayIGDQALCyABQRRqKAIADQEgAyECDAQLQQAhAiABQRRqKAIARQ0BDAILIAUoAgQgA0EQT3INAQwDC0EBIQMMAwsgAyADaiICIANJDQELIAJFDQAgAkEASA0CIAIQUCIDDQEAC0EBIQNBACECCyAAQQA2AgggACADNgIEIAAgAjYCACAEIAA2AgwgBEEgaiABQRBqKQIANwMAIARBGGogAUEIaikCADcDACAEIAEpAgA3AxAgBEEMakHgkMAAIARBEGoQkwFFDQFBpJHAAEEzIARBKGpB2JHAAEGAksAAEOkDAAsQxgUACyAEQTBqJAALhAQBAn8jAEFAaiICJAACfwJAAkACQAJAQQIgACgCECIDQQJrIANBAkkbQQFrDgMBAgMA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A0E0akEBNgIAIANBlPHAADYCKCADQQA2AiAgA0EBNgI8IAMgATYCOCADIANBOGo2AjAgA0EQaiIBIANBIGoiAhDLAyACQQAgARDyBiAAIAMpAyA3AgAgBSAHEMwEDAMLIANBLGpBAjYCACADQTRqQQE2AgAgA0Hk8MAANgIoIANBADYCICADQQE2AjwgAyABNgI4IAMgA0E4ajYCMCADQRBqIgEgA0EgaiICEMsDIAJBASABEPIGIAAgAykDIDcCAAwCCyADQRBqQSdBpPHAAEEeEIsFIAUgBxDFByAAIAMpAxA3AgAMAQsgA0EIaiAGQcgAaigCACAGQcwAaigCACAGQUBrKAIAIghB2PLAABDiBSADKAIIIQkgAygCDCIBIAIoAggiBEsEQCACKAIAIgQgAUkEQCACIAEgBGsQlAMLIAIgATYCCCABIQQLIAIoAgQgBCAJIAFB6PLAABD9BiAAIAE2AgQgBiABIAhqNgJAIABBBDoAACAFIAcQzAQLIANBQGskAAv+BAEFfyMAQSBrIgAkABDdAiIBQRBqIgJBACACKAIAIgIgAkECRiICGzYCAAJAAkACQAJAAkAgAkUEQCABQRRqIgItAAAhAyACQQE6AAAgACADQQFxIgM6AAQgAw0BQQAhA0GMncIAKAIAQf////8HcQRAEJgJQQFzIQMLIAEtABUNAiABIAEoAhAiBEEBIAQbNgIQIARFDQUgBEECRw0DIAEoAhAhBCABQQA2AhAgACAENgIEIARBAkcNBAJAIAMNAEGMncIAKAIAQf////8HcUUNABCYCQ0AIAFBAToAFQsgAkEAOgAACyABIAEoAgAiAkEBazYCACACQQFGBEAgARCVBQsgAEEgaiQADwsgAEEANgIcIABBqJXCADYCGCAAQQE2AhQgAEH03cEANgIQIABBADYCCCAAQQRqIABBCGoQrQQACyAAIAM6AAwgACACNgIIQbD7wQBBKyAAQQhqQZTOwABB2M7AABDpAwALIABBFGpBATYCACAAQRxqQQA2AgAgAEGAz8AANgIQIABBqJXCADYCGCAAQQA2AgggAEEIakGIz8AAEIEGAAsgAEEANgIcIABBqJXCADYCGCAAQQE2AhQgAEG4z8AANgIQIABBADYCCCMAQSBrIgEkACABQZDOwAA2AgQgASAAQQRqNgIAIAFBGGogAEEI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IQUgAykDGEGs5cEAEO0HIAVEAAAAAAAA4MNmIQEgAEL///////////8AAn4gBZlEAAAAAAAA4ENjBEAgBbAMAQtCgICAgICAgICAfwtCgICAgICAgICAfyABGyAFRP///////99DZBtCACAFIAVhGzcDCAwCCyADQShqIAIQhwYgAysDMCEFIAMpAyhBnOXBABDtByAAIAW2OAIEDAELIANBOGogAhCHBiADKwNAIQUgAykDOEGM5cEAEO0HIAAgBTkDCAsgACAENgIAIANBkAFqJAALtwMBDX8jAEEQayIEJABBBCEIAkACQCACBEAgAkHmzJkzSw0BIAJBFGwiBkEASA0BIAYgAkHnzJkzSUECdBDUByIIRQ0CCyAAIAg2AgQgACACNgIAIAJBFGwhDSACIQYDQCAGRSAHIA1GckUEQCAHIAhqIgUCfwJAAkACQAJAIAEgB2oiAy0AAEEBaw4DAQIDAAsgBEEIaiADQQRqKAIAIANBCGooAgAQ8gQgBCgCDCEJIAQoAgghCiAEIANBDGooAgAgA0EQaigCABDyBCAEKAIEIQsgBCgCACEMQQAMAwsgA0ECai0AACEOIANBAWotAAAhD0EBDAILIANBEGooAgAhCyADQQxqKAIAIQwgA0EIaigCACEJIANBBGooAgAhCkECDAELIANBEGooAgAhCyADQQxqKAIAIQwgA0EIaigCACEJIANBBGooAgAhCkEDCzoAACAFQRBqIAs2AgAgBUEMaiAMNgIAIAVBCGogCTYCACAFQQRqIAo2AgAgBUECaiAOOgAAIAVBAWogDzoAACAGQQFrIQYgB0EUaiEHDAELCyAAIAI2AgggBEEQaiQADwsQxgUACwAL9AMCBn8BfiMAQfAAayIEJAAgACkDACEKIAFBtOfBABDPByEBIAQgAzcDMCAEIAI2AiggBCAANgIgIAQgATYCGCAEIAo3AxAgBEE4aiIGIARBEGoQowMgBCgCIBCPBCAEQdAAaiIBKAIAIQcgBCgCTCEAIAQoAkghBSAEKAJAEIsIIAYgBUHwAGogAhCVAwJAIAQtADgEQCAELQA5IQIMAQtBAiECIAEpAwBCgICAAoNQDQAgBEEIaiAAQThqKAIAIABBPGooAgAgBCkDQCIKIARByABqKAIAIghBkIjBABClBxCoBEEIIQIgBCgCCCIBQQhqIQUg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GGogAjYCACADIAo3AwggAUECayEEIABByABqIQIgAUEFdCAAakEgayEAA0ACQCAEBEAgAkEEaygCACACKAIAIAYgBxCpBkH/AXFB/wFGDQEgAkEoayEACyAAIAY2AgQgACAHNgIIIAAgCDYCACAAIAMpAwg3AgwgAEEUaiADQRBqKQMANwIAIABBHGogA0EYaigCADYCAAwCCyACQShrIgEgAkEIayIFKQMANwMAIAFBGGogBUEYaikDADcDACABQRBqIAVBEGopAwA3AwAgAUEIaiAFQQhqKQMANwMAIARBAWshBCACQSBqIQIMAAsACyADQSBqJAAL7AIBA38CQCACIANHBEAgAyACayIFIABqIgYgBSAFIAZLGyEHIAAgA2shBSAEIAAgAmsiBk0EQCAEIAVLDQIgASADaiABIAJqIAQQlAkaDwsCQCAEIAdNBEAgBCAFSw0BIAEgA2ogASACaiAGEJQJGiABIAMgBmpqIAEgBCAGaxCUCRoPCyAEIAVNBEAgASADIAZqaiABIAQgBmsQlAkaIAEgA2ogASACaiAGEJQJGg8LIAEgBiAFayIHaiABIAQgBmsQlAkaIAEgASAAIAdraiAHEJQJIgAgA2ogACACaiAFEJQJGg8LIAEgA2ogASACaiAGEJQJGiABIAMgBmpqIAEgBSAGayIAEJQJGiABIAAgAWogBCAFaxCUCRoLDwsgBCAHTQRAIAEgA2ogASACaiAFEJQJGiABIAEgAiAFamogBCAFaxCUCRoPCyABIAEgAiAFamogBCAFaxCUCSIAIANqIAAgAmogBRCUCRoLzwMBAX8jAEFAaiICJAACQAJAAkACQAJAAkAgAC0AAEEBaw4DAQIDAAsgAiAAKAIENgIEQRQQUCIARQ0EIABBEGpBzMrAACgAADYAACAAQQhqQcTKwAApAAA3AAAgAEG8ysAAKQAANwAAIAJBFDYCECACIAA2AgwgAkEUNgIIIAJBNGpBAzYCACACQTxqQQI2AgAgAkEkakEZNgIAIAJBzMfAADYCMCACQQA2AiggAkEaNgIcIAFBBGooAgAhACACIAJBGGo2AjggAiACQQRqNgIgIAIgAkEIajYCGCABKAIAIAAgAkEoahDmBCEAIAIoAghFDQMgAigCDBB+DAMLIAAtAAEhACACQTRqQQE2AgAgAkE8akEBNgIAIAJB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AEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARBywAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVBkPPBAEECQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHMABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUHQ7cEAQQVBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQc0AELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQaPzwQBBBEGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARBzgAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB4O3BAEEHQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHPABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUHQ7cEAQQVBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQdAAELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZDzwQBBAkGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB0QAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB7u3BAEEJQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHTABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGQ88EAQQJBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQdQAELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZvzwQBBBEGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB1QAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVBhPPBAEEBQaiVwgBBABDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHWABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGS88EAQQNBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQdcAELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQdrtwQBBBkGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB2AAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVBpOjBAEECQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHdABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGolcIAQQBBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQd4AELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZvzwQBBBEGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB3wAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB0O3BAEEFQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHiABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGQ88EAQQJBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQeQAELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZjzwQBBA0GE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB5gAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB2u3BAEEGQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHoABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGS88EAQQNBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQekAELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZDzwQBBAkGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB6gAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB5+3BAEEHQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIcIANBEGogBEHrABC7BSADIAMoAhAgAygCFBD9BSIENgIgIANBIDYCJCADIAG4EEYiBTYCKCADIAK4EEYiAjYCOCAEQSAgBSACEEchAiADQThqIgQQ1QcgA0EoaiIFENUHIANBJGoQ1QcgBUGj88EAQQRBhPPBAEEBENQFIANBQGsgA0EwaikDADcDACADIAMpAyg3AzggAyACNgJIIAMgASAEEMUEIAMpAwAhBiADKAIIIQEgA0EgahDVByADQRxqENUHIAAgATYCCCAAIAY3AwAgA0HQAGokAAv5AQIDfwF+IwBB0ABrIgMkACABKAIAIQEgAxBFIgQ2AhwgA0EQaiAEQe4AELsFIAMgAygCECADKAIUEP0FIgQ2AiAgA0EgNgIkIAMgAbgQRiIFNgIoIAMgArgQRiICNgI4IARBICAFIAIQRyECIANBOGoiBBDVByADQShqIgUQ1QcgA0EkahDVByAFQZDzwQBBAkGE88EAQQEQ1AUgA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC/kBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB8AAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAVB2u3BAEEGQYTzwQBBARDUBSADQUBrIANBMGopAwA3AwAgAyADKQMoNwM4IAMgAjYCSCADIAEgBBDFBCADKQMAIQYgAygCCCEBIANBIGoQ1QcgA0EcahDVByAAIAE2AgggACAGNwMAIANB0ABqJAAL+QECA38BfiMAQdAAayIDJAAgASgCACEBIAMQRSIENgIc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KDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB3AAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwgggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB4AAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwwggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB4QAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwgggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB4wAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQxAggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB5QAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQxAggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB5wAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwgggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB7AAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwwggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB7wAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQxAggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+sBAgN/AX4jAEHQAGsiAyQAIAEoAgAhASADEEUiBDYCHCADQRBqIARB8wAQuwUgAyADKAIQIAMoAhQQ/QUiBDYCICADQSA2AiQgAyABuBBGIgU2AiggAyACuBBGIgI2AjggBEEgIAUgAhBHIQIgA0E4aiIEENUHIANBKGoiBRDVByADQSRqENUHIAUQwgggA0FAayADQTBqKQMANwMAIAMgAykDKDcDOCADIAI2AkggAyABIAQQxQQgAykDACEGIAMoAgghASADQSBqENUHIANBHGoQ1QcgACABNgIIIAAgBjcDACADQdAAaiQAC+kBAQV/IwBBIGsiASQAIAFBCGogABD6BAJAIAEoAghFBEAgAUEQai0AACEFIAEoAgwiA0EMaigCAEEMbCEEIANBCGooAgBBCGohAgNAIARFDQIgAigCAEECIAIQzQRBBEYEQCACKAIAQRRqKAIAEIcJCyAEQQxrIQQgAkEMaiECDAALAAsgASABKAIMNgIYIAEgAUEQai0AADoAHEGw+8EAQSsgAUEYakGAu8EAQZC7wQAQ6QMACyADQQRqEJ0CQQAhAiAAIAMoAgwEfyACBSADQRhqKAIARQs6ABwgAyAFENwGIAFBIGokAAvmAQEFfyMAQRBrIgIkACABKAIAIQMCQAJAIAFBKGooAgBBAkYEQCADDQEgAEKAgICAEDcCACAAQQhqQQA2AgAMAgsgAUEQaiEEIANFBEAgACAEENgCDAILIAIgBBDYAiACKAIAIQMgAigCBCEEIABBCGogAkEIaigCACIFIAFBCGooAgAgASgCBGsiAWoiBjYCACAAIARBAUYgBSAGTXE2AgQgAEF/IAEgA2oiACAAIANJGzYCAAwBCyAAQQE2AgQgAEEIaiABQQhqKAIAIAEoAgRrIgE2AgAgACABNgIACyACQRBqJAAL3wEBBn8jAEEgayIBJABBgYCAgHghBAJAIAAoAhAiBSAAQRhqKAIAIgJrIAAoAgQgACgCCGogAmsiA08NACACIAIgA2oiA0sEQEEAIQQgAyECDAELIANBKGwhAiADQbTmzBlJQQN0IQYCQCAFBEAgAUEINgIYIAEgBUEobDYCFCABIABBFGooAgA2AhAMAQsgAUEANgIYCyABIAIgBiABQRBqEOACIAEoAgQhAiABKAIABEAgAUEIaigCACEEDAELIAAgAzYCECAAQRRqIAI2AgALIAIgBBCpByABQSBqJAAL2QEBBX8jAEEgayIGJAAgBkEQaiIEIAEoAgBBCGoQ5gggBkEIaiAEQYS0wQAQ4AQgBi0ADCEHIAYoAggiAUEEaiADEP8CAkAgAyABKAIEIgQgAUEQaigCACIIIAFBDGooAgBqIgUgBEEAIAQgBU0bayIFayIESwRAIAUgAUEIaigCACIFaiACIAQQkgkaIAUgAiAEaiADIARrEJIJGgwBCyABQQhqKAIAIAVqIAIgAxCSCRoLIAEgAyAIajYCECAAQQQ6AAAgACADNgIEIAEgBxD5ByAGQSBqJAAL+AEBAn8jAEHQAGsiAyQAIANBADYCCCADQoCAgIAQNwMAIANBEGogASADIAIoAjwRAwACQCADLQAQQQRGBEAgACADKQMANwIAIABBCGogA0EIaigCADYCAAwBCyADIAMpAxA3AxggA0E8akECNgIAIANBxABqQQE2AgAgA0G0w8EANgI4IANBADYCMCADQTM2AkwgAyADQcgAajYCQCADIANBGGoiBDYCSCADQSBqIANBMGoQzAMgAygCJCIBIAMoAigQOCECIAMoAiAgARCGCCAEEOwFIABBADYCBCAAIAI2AgAgAygCACADKAIEEIYICyADQdAAaiQAC+MBAQV/IwBBEGsiAiQAIAEoAgAhAwJAAkAgASgCEEECRgRAIAMNASAAQoCAgIAQNwIAIABBCGpBADYCAAwCCyABQRBqIQQgA0UEQCAAIAQQ0wIMAgsgAiAEENMCIAIoAgAhAyACKAIEIQQgAEEIaiACQQhqKAIAIgUgAUEIaigCACABKAIEayIBaiIGNgIAIAAgBEEBRiAFIAZNcTYCBCAAQX8gASADaiIAIAAgA0kbNgIADAELIABBATYCBCAAQQhqIAFBCGooAgAgASgCBGsiATYCACAAIAE2AgALIAJBEGokAAviAQEF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QQE6AAFBAQwCCyADBEAgAkEIaigCACIBIAEoAgBBAWs2AgALIABBgQg7AQAMAgsgACABQcwAaigCACABKAJAazYCBEEACzoAACAEIAQoAgBBAWs2AgALIAJBEGokAAvbAQIBfwF8IwBBMGsiAyQAIAMgARC1ByACEJUEKAIQEBYiATYCJCADQaC+wQBBChAHIgI2AiwgA0EYaiABIAIQvAUgAyADKAIYIAMoAhwQ8wUiAjYCKCADQQhqIAIQhwYgAysDECEEIAMpAwgQ4QcgA0EoahDVByADQSxqENUHIAEQFyEBIANBJGoQ1QcgACABNgIIIABCfwJ+IAREAAAAAAAAAABmIgAgBEQAAAAAAADwQ2NxBEAgBLEMAQtCAAtCACAAGyAERP///////+9DZBs3AwAgA0EwaiQAC9EBAQR/IwBBQGoiAyQAIAMgARD4BSADKAIEIQVBACEBIAMoAgAiBCgCACACIAQoAgQoAogBEREAQf8BcSIEQRlHBEAgAyAEOgAPIANBLGpBAjYCACADQTRqQQE2AgAgA0GQw8EANgIoIANBADYCICADQTI2AjwgAyADQThqNgIwIAMgA0EPajYCOCADQRBqIANBIGoQzAMgAygCFCIEIAMoAhgQOCEGIAMoAhAgBBCGCEEBIQELIAVBADYCACAAIAE2AgQgACAGNgIAIANBQGskAAvSAQIDfwF+IwBBMGsiAyQAIANBCGogASACEIUDIAMoAhAhAiADKQMIIQYgASgCbCIEQYACaigCACIBKAIIIQUgAUF/NgIIAkAgBUUEQCADQRhqIAFBCGoQhAUgAygCGA0BIAMoAhwhASAAQRhqIANBIGotAAA6AAAgACABNgIUIAAgBEEIajYCECAAIAI2AgggACAGNwMAIANBMGokAA8LAAsgAyADKAIcNgIoIAMgA0Egai0AADoALEGw+8EAQSsgA0EoakGwrMEAQcSuwQAQ6QMAC9cBAQN/IwBBEGsiAiQAIAJBCGogARD7BSACKAIMIQMgAiACKAIIIgEgASgCeBCxAygCbCIBQdgBaigCACABQdwBaigCACgCGBEAAAJAIAACfyACKAIAIgEgAigCBCgCDBEHAELG5ezG+63msqd/UiABRXJFBEAgASgCACIEIAQoAgAiAUEBajYCACABQQBIDQJBACEBIANBADYCACAEEOkH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AyACIAFBDGooAgAgAUEQaigCABDyBCAAQQxqIAIpAwA3AgAgACADNwIEQQAMAwsgACABLwABOwABQQEMAgsgACABKQIENwIEIABBDGogAUEMaikCADcCAEECDAELIAAgASkCBDcCBCAAQQxqIAFBDGopAgA3AgBBAws6AAAgAkEQaiQAC8oBAQV/IwBBIGsiAiQAAkAgACgCBCIDRQRAIAFBqJXCAEEAEFchAwwBCyAAKAIAIQAgAiADNgIMIAIgADYCCCACQRBqIAJBCGoQqAEgAigCECIABEAgASgCBCEEIAEoAgAhBQNAIAIoAhQhBiACKAIcRQRAIAEgACAGEFchAwwDC0EBIQMgBSAAIAYgBCgCDBEEAA0CIAVB/f8DIAQoAhARAgANAiACQRBqIAJBCGoQqAEgAigCECIADQALC0EAIQMLIAJBIGokACADC88BAQJ/IwBBEGsiBSQAIAEhBAJAAkACQAJAAkACQCACp0EBaw4CAAECCyABQQxqIQQLIAQ1AgAgA3wiA0IAWQ0BIAVBCGpBFEG888AAQRkQiwUgAEEBNgIAIAAgBSkDCDcCBAwDCyADQgBTDQELIANC/////w9WBEAgAEEBNgIAIABCgSg3AgQMAgsgAEEANgIAIAEgAUEMaigCACIBIAOnIgQgASAESRsiATYCACAAIAGtNwMIDAELIABBATYCACAAQoEoNwIECyAFQRBqJAALuwEBBX8jAEEgayICJABBgYCAgHghBAJAIAAoAgAiBSAAKAIIIgZrIAFPDQAgBiABIAZqIgNLBEBBACEEIAMhAQwBCyADQX9zQR92IQECQCAFBEAgAkEBNgIYIAIgBTYCFCACIAAoAgQ2AhAMAQsgAkEANgIYCyACIAMgASACQRBqEOACIAIoAgQhASACKAIABEAgAkEIaigCACEEDAELIAAgAzYCACAAIAE2AgQLIAEgBBCpByACQSBqJAALvAEBAX8jAEEgayIDJAAgAyACNgIMIANBEGoiAiABQTBqEOMGIAMgAkHIlsEAEMAFIAMoAgQhASAAAn8gAygCACADQQxqEJsDIgIEQCAAQTBqIAIoAig2AgAgAEEoaiACKQMgNwMAIABBIGogAikDGDcDACAAQRhqIAIpAxA3AwAgAEEQaiACKAIINgIAIAAgAikDADcDCEEADAELIABBCDoAAUEBCzoAACABIAEoAgBBAWs2AgAgA0EgaiQAC7cBAQF/IwBB0ABrIgEkACAAQQRPBEAgASAANgIMIAFBHGpBATYCACABQSRqQQE2AgAgAUE8akECNgIAIAFBxABqQQE2AgAgAUHUj8IANgIYIAFBADYCECABQQk2AiwgAUGQkMIANgI4IAFBADYCMCABQRk2AkwgASABQShqNgIgIAEgAUEwajYCKCABIAFByABqNgJAIAEgAUEMajYCSCABQRBqQYiRwgAQgQYACyABQdAAaiQAIAALxgEBAX8jAEEQayILJAAgACgCACABIAIgACgCBCgCDBEEACEBIAtBADoADSALIAE6AAwgCyAANgIIIAtBCGogAyAEIAUgBhDfASAHIAggCSAKEN8BIQECfyALLQAMIgAgCy0ADUUNABpBASAAQf8BcQ0AGiABKAIAIgAtABhBBHFFBEAgACgCAEHvn8AAQQIgACgCBCgCDBEEAAwBCyAAKAIAQeGfwABBASAAKAIEKAIMEQQACyEAIAtBEGokACAAQf8BcUEARwvAAQIDfwN+IANCGYhC/wCDQoGChIiQoMCAAX4hCyADpyEGA0AgAiABIAZxIgZqKQAAIgkgC4UiA0J/hSADQoGChIiQoMCAAX2DQoCBgoSIkKDAgH+DIQoDQAJAIAoiA1AEQCAJIAlCAYaDQoCBgoSIkKDAgH+DQgBSDQEgBiAHQQhqIgdqIQYMAwsgA0IBfSADgyEKIAQgA3qnQQN2IAZqIAFxIgggBRECAEUNAQsLCyAAIAg2AgQgACADQgBSNgIAC7sBAQF/IwBBQGoiBCQAIAQgAUGAAWogAiADELwDIAQtAABBBEYEf0EABSAEIAQpAwA3AwggBEEsakECNgIAIARBNGpBATYCACAEQaTWwQA2AiggBEEANgIgIARBMzYCPCAEIARBOGo2AjAgBCAEQQhqIgE2AjggBEEQaiAEQSBqEMwDIAQoAhQiAiAEKAIYEDghAyAEKAIQIAIQhgggARDsBUEBCyEBIAAgAzYCBCAAIAE2AgAgBEFAayQAC70BAQR/IwBBIGsiBSQAIAVBCGogASgCBCABKAIIIgQgAyAEIAMgBEkbIgRB+P7AABDPBSAFKAIMIQYgBSgCCCEHAkACfyAEQQFGBEAgBkUNAiADBEAgAiAHLQAAOgAAQQEMAgtBAEEAQcj7wAAQ/wMACyACIAQgByAGQZj/wAAQ/QYgBAshAyAFQQhqIgIgASADEJcFIAIQ9gcgAEEEOgAAIAAgBDYCBCAFQSBqJAAPC0EAQQBBqP/AABD/AwALqQECAn8BfiMAQSBrIgIkACAAQRhqKAIABEAgACkDACAAQQhqKQMAIAEoAgAQ/AMhBCACIAE2AhQgAEEcaiIBKAIAIQMgAiAAQRBqIgA2AhwgACgCACEAIAIgAkEUajYCGCACQQhqIAAgAyAEIAJBGGpBKhCYAyABKAIAIgAgAigCDEFIbGpBOGtBACAAG0EAIAIoAggbIQMLIAJBIGokACADQQhqQQAgAxsLwAEBBX8jAEEgayIBJAAgAC0AHEUEQCABQQhqIAAQ+gQCQCABKAIIRQRAIAFBEGotAAAhBCABKAIMIQIgAC0AHA0BIAFBCGoiBSACQQRqIgMQvwMgBRDgByADEJ0CQQAhAyAAIAJBDGooAgAEfyADBSACQRhqKAIARQs6ABwMAQsgASABKAIMNgIYIAEgAUEQai0AADoAHEGw+8EAQSsgAUEYakH06sEAQfz7wQAQ6QMACyACIAQQ3AYLIAFBIGokAAuiAQECfyMAQdAAayIDJAAgAwJ/IAIEQEEBIAEtAABBL0YNARoLQQALOgAuIANBBjoAGCADIAI2AhQgAyABNgIQIANBgAQ7ASwgA0EwaiADQRBqEGBBACECIAAgAy0AOCIEQQpGIARBBklyIARBB2tBAktyBH8gAQUgA0EIaiADQRBqEGcgAygCCCECIAMoAgwLNgIEIAAgAjYCACADQdAAaiQAC7cBAQJ/IwBBEGsiBCQAIAQgAiADENMBIAQtAAAhAwJAIAQoAgQiBQRAIAQvAAEgBC0AAyECIAQgASAFIAQoAggiARChASACQRB0ciECIAQtAABFBEAgACAEKAIENgIMIAAgATYCCCAAIAU2AgQgACACQQh0IANyNgIADAILIAQtAAEhASAAQQA2AgQgACABOgAAIAJBCHQgA3IgBRCGCAwBCyAAQQA2AgQgACADOgAACyAEQRBqJAALuwEBAX8jAEEgayIEJAAgBCADNgIUIAQgAjYCECAEQRBqEMEFIARBCGogBCgCFBD1BCAEQRhqIAEgBCgCCCAEKAIMEJoDAkAgBC0AGCIBQQRGBEAgBCgCHCEBIABBBDoAACAEKAIUIgAgASAAKAIIaiIBNgIIIAAgACgCDCIAIAEgACABSxs2AgwMAQsgACAELwAZOwABIABBA2ogBC0AGzoAACAAIAQoAhw2AgQgACABOgAACyAEQSBqJAALrQECA38BfiMAQSBrIgQkAAJAAn9BASABIAOtfCIHIAFUDQAaQQAgByAAKAIAEBmtVg0AGiAEIAAoAgAgAacgB6cQ8AgiABAZIgU2AgAgBCADNgIEIAMgBUcNARAVIgUQFiIGIAIgAxAqIQIgBRCLCCAGEIsIIAAgAkEAEBggAhCLCCAAEIsIQQMLIQAgBEEgaiQAIAAPCyAEQQA2AhAgBCAEQQRqIARBCGoQqwQAC8ABAQJ/IwBB0ABrIgIkACACQSI2AjQgAiAANgIwIAJBATYCTCACQQE2AkQgAkHI4cAANgJAIAJBADYCOCACIAJBMGo2AkggAkEgaiIDIAJBOGoQrQEgAkEMakEBNgIAIAJBFGpBATYCACACQRg2AhwgAkGE4sAANgIIIAJBADYCACABQQRqKAIAIQAgAiADNgIYIAIgAkEYajYCECABKAIAIAAgAhDmBCEAIAIoAiAgAigCJBCGCCACQdAAaiQAIAALuwEBAX8jAEEQayIHJAAgACgCACABIAIgACgCBCgCDBEEACEBIAdBADoADSAHIAE6AAwgByAANgIIIAdBCGogAyAEIAUgBhDfASEBAn8gBy0ADCIAIActAA1FDQAaQQEgAEH/AXENABogASgCACIALQAYQQRxRQRAIAAoAgBB75/AAEECIAAoAgQoAgwRBAAMAQsgACgCAEHhn8AAQQEgACgCBCgCDBEEAAshACAHQRBqJAAgAEH/AXFBAEcLzAEBA38jAEEgayIBJAACQCAAKQMAIAAoAhAiAikDAFEEQCACQcwAaigCACIDIAAoAghBAWsiAEsNASAAIANB3NjBABD/AwALIAFBADYCHCABQaiVwgA2AhggAUEBNgIUIAFB1NfBADYCECABQQA2AgggACACIAFBCGpBvNjBABCyBAALIAJByABqKAIAIABBA3RqIgAoAgAiAiAAKAIEKAIMEQcAQpHj2q7y/IqVu39SBEBB9/jBAEErQZC+wQAQkQUACyABQSBqJAAgAgu1AQEBfyMAQSBrIgMkACADIAI2AhQgAyABNgIQIANBEGoQwQUgA0EIaiADKAIUEPUEIANBGGogAyADIAMQzgYCQCADLQAYIgFBBEYEQCADKAIcIQEgAEEEOgAAIAMoAhQiACABIAAoAghqIgE2AgggACAAKAIMIgAgASAAIAFLGzYCDAwBCyAAIAMvABk7AAEgAEEDaiADLQAbOgAAIAAgAygCHDYCBCAAIAE6AAALIANBIGokAAu1AQEBfyMAQSBrIgMkACADIAI2AhQgAyABNgIQIANBEGoQwQUgA0EIaiADKAIUEPUEIANBGGogAyADIAMQ0AYCQCADLQAYIgFBBEYEQCADKAIcIQEgAEEEOgAAIAMoAhQiACABIAAoAghqIgE2AgggACAAKAIMIgAgASAAIAFLGzYCDAwBCyAAIAMvABk7AAEgAEEDaiADLQAbOgAAIAAgAygCHDYCBCAAIAE6AAALIANBIGokAAu3AQEFfyMAQSBrIgIkACACQQhqIAEQ+AUgAigCDCEEIAJBEGogAigCCCIBKAIAIAFBBGooAgAQ1gIgAigCGCEFIAIoAhQhAyACKAIQIQEgBEEANgIAAkAgA0UEQEEBIQYMAQsgAiAFNgIYIAIgAzYCFCACIAE2AhAgAiACQRBqEJ0FIAIoAgQhAyACKAIAIQRBACEBCyAAIAY2AgwgACABNgIIIAAgAzYCBCAAIAQ2AgAgAkEgaiQAC7wBAQN/IwBBMGsiAiQAIAEoAgwhBCACIAEQuQUgAiACKAIEIgE2AgwgAiACKAIAIgM2AggCQAJAIANBAUYEQCACQSBqIgMgARCKBCACQRBqIANB/OHBAEEdEDgQjAYgARCLCCACKAIQIQEgAigCFCIDRQRAIAQQgwggBCABNgIEIARBATYCAAwCCyAAIAIoAhg2AgggACADNgIEIAAgATYCAAwCCyACQQhqEIMICyAAQQA2AgQLIAJBMGokAAu1AQEBfyMAQUBqIgIkACACQgA3AzggAkE4aiAAKAIAECQgAkEUakECNgIAIAJBHGpBATYCACACIAIoAjwiADYCMCACIAIoAjg2AiwgAiAANgIoIAJBGDYCJCACQbjVwAA2AhAgAkEANgIIIAFBBGooAgAhACACIAJBKGo2AiAgAiACQSBqNgIYIAEoAgAgACACQQhqEOYEIQAgAigCKCIBBEAgAigCLCABEKQICyACQUBrJAAgAAu2AQEDfyMAQSBrIgQkAAJAAkACQAJAIAMgASgCCCIFTQRAIARBCGogASgCBCAFIANBmPvAABDPBSAEKAIMIQUgBCgCCCEGIANBAUcNASAFRQ0CIAIgBi0AADoAAEEBIQMMAwsgAEKCgICAgMWbCDcCAAwDCyACIAMgBiAFQaj7wAAQ/QYMAQtBAEEAQbj7wAAQ/wMACyAEQQhqIgIgASADEJcFIAIQ9gcgAEEEOgAACyAEQSBqJAALsAEBAn8jAEEQayIEJAACQAJAA0AgAwRAIARBCGogASACIAMQsgECQAJAIAQtAAhBBEYEQCAEKAIMIgUNASAAQajcwQA2AgQgAEECNgIADAULIARBCGoQvQZB/wFxQSNGDQEgACAEKQMINwIADAQLIAMgBUkNBCADIAVrIQMgAiAFaiECDAILIARBCGoQ7AUMAQsLIABBBDoAAAsgBEEQaiQADwsgBSADQfzbwQAQyQgAC7EBAQN/IAEoAgQhAyABKAIAIgIgASgCCCIBSwRAIAECfwJAIAFFBEAgAyACEKQIQQEhAgwBC0EBIAMgAkEBIAEQdiICRQ0BGgsgAiEDQYGAgIB4CxCpBwsCfyABRQRAQdiTwAAhAkEAIQFBqJXCACEDQQAMAQtBvMbBACECIAMgA0EBcQ0AGkGwxsEAIQIgA0EBcgshBCAAIAI2AgwgACAENgIIIAAgATYCBCAAIAM2AgALvgEBAn8jAEEQayICJAAgAAJ/QQEgAC0ABA0AGiAAKAIAIQEgAEEFai0AAEUEQCABKAIAQeifwABBByABKAIEKAIMEQQADAELIAEtABhBBHFFBEAgASgCAEHin8AAQQYgASgCBCgCDBEEAAwBCyACQQE6AA8gAiABKQIANwMAIAIgAkEPajYCCEEBIAJB3p/AAEEDEJQBDQAaIAEoAgBB4Z/AAEEBIAEoAgQoAgwRBAALIgA6AAQgAkEQaiQAIAALkwECAn8BfkEIIQQCQAJAIAGtIAKtfiIFQiCIpw0AIAWnIgFBB2oiAyABSQ0AIAIgA0F4cSIDakEIaiIBIANJIAFBAEhyDQAgAQRAIAFBCBDPASEECyAERQ0BIABBADYCCCAAIAMgBGo2AgwgACACQQFrIgE2AgAgACABIAJBA3ZBB2wgAUEISRs2AgQPCxDIBQALAAuwAQIBfwF+IwBBEGsiBCQAIAQgAzYCBCAEIAI2AgAgBEEAEIQCQoKAgICA5Z0IIQUDQAJAAkAgBCgCBCICRQRAIABBBDoAAAwBCyAEQQhqIAEgBCgCACACENQEAkAgBC0ACEEERgRAIAQoAgwiAkUNASAEIAIQhAIMBAsgBEEIahC9BkH/AXFBI0YNAiAEKQMIIQULIAAgBTcCAAsgBEEQaiQADwsgBEEIahDsBQwACwAL+wEBBn8CQAJAIAAvAQQiA0UNACAAKAIAIgJBD0sNAANAIAJBEEYNAkEBIQFBACEEAkACQAJAAkACQAJAIANBASACdCIFcUH//wNxIgZBAWsOCAQABQEFBQUCAwtBAiEBDAMLQQQhAQwCC0EIIQEMAQsgBkEQRw0BQRAhAQsgASEECyAAIAJBAWoiAjYCACAAIAMgBUF/c3EiAzsBBCAERQ0ACwsgBA8LIwBBIGsiACQAIABBDGpBATYCACAAQRRqQQE2AgAgAEG4scEANgIIIABBADYCACAAQQQ2AhwgAEHossEANgIYIAAgAEEYajYCECAAQdSzwQAQgQYAC7ABAgF/AX4jAEEQayIEJAAgBCADNgIEIAQgAjYCACAEQQAQ/QFCgoCAgIDlnQghBQNAAkACQCAEKAIEIgJFBEAgAEEEOgAADAELIARBCGogASAEKAIAIAIQ2wQCQCAELQAIQQRGBEAgBCgCDCICRQ0BIAQgAhD9AQwECyAEQQhqEL0GQf8BcUEjRg0CIAQpAwghBQsgACAFNwIACyAEQRBqJAAPCyAEQQhqEOwFDAALAAvHAQECfyMAQSBrIgIkAAJAIAApAwAgASkDAFEEQCABQcwAaigCACIDIAAoAghBAWsiAEsNASAAIANB/NjBABD/AwALIAJBADYCHCACQaiVwgA2AhggAkEBNgIUIAJB1NfBADYCECACQQA2AgggACABIAJBCGpBzNjBABCyBAALIAFByABqKAIAIABBA3RqIgAoAgAiASAAKAIEKAIMEQcAQpHj2q7y/IqVu39SBEBB9/jBAEErQazHwQAQkQUACyACQSBqJAAgAQuwAQIBfwF+IwBBEGsiBCQAIAQgAzYCBCAEIAI2AgAgBEEAEIQCQoKAgICA5Z0IIQUDQAJAAkAgBCgCBCICRQRAIABBBDoAAAwBCyAEQQhqIAEgBCgCACACEOEEAkAgBC0ACEEERgRAIAQoAgwiAkUNASAEIAIQhAIMBAsgBEEIahC9BkH/AXFBI0YNAiAEKQMIIQULIAAgBTcCAAsgBEEQaiQADwsgBEEIahDsBQwACwALqAEBAX4jAEEQayIBJAAgASADNgIEIAEgAjYCACABQQAQ/QFCgoCAgIDlnQghBANAAkACQCABKAIERQRAIABBBDoAAAwBCyABQQhqIAEoAgAQ3ggCQCABLQAIQQRGBEAgASgCDCICRQ0BIAEgAhD9AQwECyABQQhqEL0GQf8BcUEjRg0CIAEpAwghBAsgACAENwIACyABQRBqJAAPCyABQQhqEOwFDAALAAulAQEDfyAAKAIEIgFBKGohAiAAKAIIIAFrQSxuQSxsIQMDQCADBEAgASgCACABQQRqKAIAEIYIIAFBDGooAgAgAUEQaigCABCGCCABLQAYRQRAIAJBDGsoAgAgAkEIaygCABCkCCACQQRrKAIAIAIoAgAQpAgLIAFBLGohASADQSxrIQMgAkEsaiECDAELCyAAKAIAIgEEQCAAKAIMIAFBLGwQpAgLC6EBAgN/AX4jAEEQayIBJAAgASAAKAIEQQhqEIoFAkAgASgCAARAIAEQygYMAQsgAUEIaigCACECAkAgACgCACIAIAEoAgQiA0EQaigCAE8NACADQQxqKAIAIABB0ABsaiIAKAIAIgNBAkYNACAAQSBBGCADG2opAwghBCACIAIoAgBBAWs2AgAMAQsgAiACKAIAQQFrNgIACyABQRBqJAAgBAuhAQICfwF+IwBBIGsiAiQAIABBGGooAgAEfyAAKQMAIABBCGopAwAgAUEEaigCACABQQhqKAIAEKAEIQQgAiABNgIUIABBHGoiASgCACEDIAIgAEEQaiIANgIcIAAoAgAhACACIAJBFGo2AhggAkEIaiAAIAMgBCACQRhqQcoAEJgDIAIoAghBAEcgASgCAEEAR3EFQQALIQAgAkEgaiQAIAALtwECAX8BfiMAQUBqIgQkACAAKQMAIQUgAUG058EAEM8HIQEgAhCWAyECIAQgAzYCLCAEIAA2AiAgBCABNgIYIAQgBTcDECAEIAJB/wFxIgA6ACggBCAEQRBqEKMDIAQoAiAQhQMgBCAEKAIIIgE2AjggBCAEKQMANwMwIAMgBEEwakKAreIEQgEgAEEBRhsQ0QdB/wFxEIgHIQAgARCLCCAEQUBrJAAgAEH/AXEiAEEAIABBzQBHGwuqAQIBfwF+IwBBMGsiBiQAIAApAwAhByABQdTnwQAQzwchASAGIAU2AiwgBiAENgIoIAYgAzYCJCAGIAI2AiAgBiAANgIYIAYgATYCECAGIAc3AwggBiAGQQhqIAIgAyAEIAUQTgJAIAYpAwAiB6ciAUECRwRAQQgQUCIARQ0BIAAgATYCACAAIAdCIIg+AgQgABCoCAALIAZBMGokACAHQiCIp0H/AXEPCwALsQECA38BfiMAQSBrIgEkACAAKAIAIgMEQAJAIAAoAggiAkUEQCAAQQxqKAIAIQAMAQsgACgCDCIAKQMAIQQgASACNgIYIAEgADYCECABIAAgA2pBAWo2AgwgASAAQQhqNgIIIAEgBEJ/hUKAgYKEiJCgwIB/gzcDAANAIAEQ5wMiAkUNASACQSBrIgIoAgAgAkEEaigCABCGCAwACwALIAMgAEEgQQgQ6AULIAFBIGokAAuwAQEDfyMAQSBrIgEkACAAKAIAIgIoAgAhAyACQQA2AgAgAygCDCECIANBADYCDCACBEAgAhEKACEDIAAoAgQiAigCACIAKAIABEAgAEEEahDVByACKAIAIQALIAAgAzYCBCAAQQE2AgAgAUEgaiQAQQEPCyABQRRqQQE2AgAgAUEcakEANgIAIAFB3NzAADYCECABQaiVwgA2AhggAUEANgIIIAFBCGpBwN3AABCBBgALwAEBAX8jAEEQayICJAACfwJAAkACQAJAIAAoAgAiAC0AAEEBaw4DAQIDAAsgAiAAQQRqNgIMIAFB2ObAAEEIIAJBDGpB4ObAABCKAwwDCyACIABBAWo2AgwgAUHA5sAAQQYgAkEMakHI5sAAEIoDDAILIAIgAEEEajYCDCABQajmwABBBSACQQxqQbDmwAAQigMMAQsgAiAAQQRqNgIMIAFBj8jBAEEGIAJBDGpBmObAABCKAwshACACQRBqJAAgAAuqAQICfwF+IwBBEGsiBCQAQoKAgICA5Z0IIQYDQAJAAkAgA0UEQCAAQQQ6AAAMAQsgBEEIaiABIAIgAxDVAgJAIAQtAAhBBEYEQCAEKAIMIgVFDQEgBCAFIAIgA0GA78EAEL4GIAQoAgQhAyAEKAIAIQIMBAsgBEEIahC9BkH/AXFBI0YNAiAEKQMIIQYLIAAgBjcCAAsgBEEQaiQADwsgBEEIahDsBQwACwALnAEBBn8jAEEQayIBJAAgASAAQQxqIgMQ9gMgAUEMaigCACEEIAEoAgghAiAAQRBqKAIAIgUgASgCACIGQQN0aiABKAIEIAZrENQGIAUgAkEDdGogBCACaxDUBiADKAIAIgIEQCAAKAIQIAJBA3QQpAgLAkAgAEF/Rg0AIAAgACgCBCICQQFrNgIEIAJBAUcNACAAEH4LIAFBEGokAAuSAQACfwJAAkAgAgRAAkAgAUEATgRAIAMoAggNAQwECwwCCyADKAIEIgJFDQIgAygCACACQQEgARB2DAMLIAAgATYCBAsgAEEIakEANgIAIABBATYCAA8LIAEQUAsiAgRAIAAgAjYCBCAAQQhqIAE2AgAgAEEANgIADwsgACABNgIEIABBCGpBATYCACAAQQE2AgALmwEBBX8gASgCCEEMbCEDIAEoAgQhAgNAIAMEQAJAIAJBCGoiBigCACIEQRBqKAIAEOYFRg0AIAYoAgBBAyACKAIAEM0EQQRHDQAgAkEEaigCACICBEAgBEEMaiACNgIACyAEQRRqKAIAEIcJIAAgASAFQZD7wQAQqgQPCyACQQxqIQIgA0EMayEDIAVBAWohBQwBCwsgAEEANgIIC6EBAQF/IwBBQGoiAiQAIAIgAC0AACIAEHIgAkEsakEZNgIAIAJBFGpBAzYCACACQRxqQQI2AgAgAiACKQMANwMwIAJBBDYCJCACQaCPwgA2AhAgAkEANgIIIAIgADYCPCABQQRqKAIAIQAgAiACQTxqNgIoIAIgAkEwajYCICACIAJBIGo2AhggASgCACAAIAJBCGoQ5gQhACACQUBrJAAgAAujAQEBfyMAQTBrIgMkACADQQQ6AAggAyABNgIQIANBKGogAkEQaikCADcDACADQSBqIAJBCGopAgA3AwAgAyACKQIANwMYAkACQCADQQhqQaTvwAAgA0EYahCTAUUEQCAAQQQ6AAAMAQsgAy0ACEEERgRAIABBuO/BADYCBCAAQQI2AgAMAQsgACADKQMINwIADAELIANBCGoQ9QcLIANBMGokAAujAQEBfyMAQTBrIgMkACADQQQ6AAggAyABNgIQIANBKGogAkEQaikCADcDACADQSBqIAJBCGopAgA3AwAgAyACKQIANwMYAkACQCADQQhqQZiiwQAgA0EYahCTAUUEQCAAQQQ6AAAMAQsgAy0ACEEERgRAIABBuO/BADYCBCAAQQI2AgAMAQsgACADKQMINwIADAELIANBCGoQ9QcLIANBMGokAAujAQEBfyMAQTBrIgMkACADQQQ6AAggAyABNgIQIANBKGogAkEQaikCADcDACADQSBqIAJBCGopAgA3AwAgAyACKQIANwMYAkACQCADQQhqQbCiwQAgA0EYahCTAUUEQCAAQQQ6AAAMAQsgAy0ACEEERgRAIABBuO/BADYCBCAAQQI2AgAMAQsgACADKQMINwIADAELIANBCGoQ9QcLIANBMGokAAujAQEBfyMAQTBrIgMkACADQQQ6AAggAyABNgIQIANBKGogAkEQaikCADcDACADQSBqIAJBCGopAgA3AwAgAyACKQIANwMYAkACQCADQQhqQciiwQAgA0EYahCTAUUEQCAAQQQ6AAAMAQsgAy0ACEEERgRAIABBuO/BADYCBCAAQQI2AgAMAQsgACADKQMINwIADAELIANBCGoQ9QcLIANBMGokAAuoAQICfwF+IwBBIGsiAyQAIAIoAgghBCADQQhqIAEgAhC7ASAEIAIoAggiAU0EQCADQRBqIAIoAgQgBGogASAEaxB8IAMpAwghBQJAIAMoAhBFBEAgACAFNwIADAELAkAgBUL/AYNCBFEEQCAAQfDbwQA2AgQgAEECNgIADAELIAAgBTcCAAsgBCEBCyACIAE2AgggA0EgaiQADwsgBCABQbzbwQAQyQgAC6MBAQF/IwBBMGsiAyQAIANBBDoACCADIAE2AhAgA0EoaiACQRBqKQIANwMAIANBIGogAkEIaikCADcDACADIAIpAgA3AxgCQAJAIANBCGpBkO/BACADQRhqEJMBRQRAIABBBDoAAAwBCyADLQAIQQRGBEAgAEG478EANgIEIABBAjYCAAwBCyAAIAMpAwg3AgAMAQsgA0EIahD1BwsgA0EwaiQAC6UBAQR/IwBB8ABrIggkACABIAEoAnwiCUEBajYCfCAIQQhqIgogAUEwahDICCAIIApB7JfBABDYBCAILQAEIQsgCCgCACEBIAggBDsBaCAIIAM3A1ggCCACNwNQIAggBTsBaiAIQgA3A2AgCCAHNgJIIAggBjcDQCAKIAFBCGogCSAIQUBrEOQGIAEgCxCHCCAAQQA6AAAgACAJNgIEIAhB8ABqJAALnQECAX8BfiMAQSBrIgIkACAAKQMAIQMgAUGk58EAEM8HIQEgAiAANgIYIAIgATYCECACIAM3AwggAiACQQhqEKMDEPQEAkBCAiACNQIAIgMgAjUCBEIghoQgA0ICURsiA6ciAUECRwRAQQgQUCIARQ0BIAAgATYCACAAIANCIIg+AgQgABCoCAALIAJBIGokACADQiCIp0H/AXEPCwALrgECA38BfiMAQRBrIgIkACABKQMIIgVCgICAgBBUBEAgAiAFpyIDQQAQkQQgAigCACEEIAJBCGogASgCECABKQMAIAIoAgQiASADEKMEAkAgAigCCARAIAAgAzYCCCAAIAE2AgQgACAENgIADAELIAItAAwhAyAAQQA2AgQgACADOgAAIAQgARCGCAsgAkEQaiQADwtBnrbBAEEZIAJBCGpBvI/AAEG4tsEAEOkDAAuWAQEDfyMAQYABayIDJAAgAC0AACECQQAhAANAIAAgA2pB/wBqQTBBNyACQQ9xIgRBCkkbIARqOgAAIABBAWshACACIgRBBHYhAiAEQQ9LDQALIABBgAFqIgJBgQFPBEAgAkGAAUGUoMAAEMkIAAsgAUEBQZCUwgBBAiAAIANqQYABakEAIABrEIsBIQAgA0GAAWokACAAC5sBAQJ/IwBBIGsiAiQAIAFBFGooAgAhAwJAAkAgAAJ/AkACQCABQQxqKAIADgIAAQMLIAMNAkEAIQNBqJXCAAwBCyADDQEgASgCCCIBKAIEIQMgASgCAAsgAxCmBQwBCyACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCAAIAJBCGoQrQELIAJBIGokAAubAQECfyMAQSBrIgIkACABQRRqKAIAIQMCQAJAIAACfwJAAkAgAUEMaigCAA4CAAEDCyADDQJBACEDQaiVwgAMAQsgAw0BIAEoAggiASgCBCEDIAEoAgALIAMQmwQMAQsgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggACACQQhqEK0BCyACQSBqJAALsgEBAn8jAEEQayICJAACfwJAAkACQCAAKAIAIgAtABQiA0EDa0EAIANBA0sbQQFrDgIBAgALIAIgADYCCCACIABBFGo2AgwgAUG45cAAQRAgAkEIakGo5cAAIAJBDGpBqOXAABCCAwwCCyACIAA2AgwgAUGb5cAAQQ0g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KAIAIAJBFGxqIgAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqKAIANgIAIAMLdwECfyAAQRxqKAIAIgJBAWoQ6wchAyAAIAAoAhQgAkcEfyADBSAAQRRqIAIQgAMgACgCHCICQQFqCzYCHCAAQRhqKAIAIAJBFGxqIgAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqKAIANgIAIAMLdwECfyAAQRBqKAIAIgJBAWoQ6wchAyAAIAAoAgggAkcEfyADBSAAQQhqIAIQgAMgACgCECICQQFqCzYCECAAQQxqKAIAIAJBFGxqIgAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAEEQaiABQRBqKAIANgIAIAMLiQEBBH8jAEEQayICJAAgAiABQQRqELkFAkACQCACKAIARQRAIABBBjYCAAwBCyACKAIEIQQgASABKAIAIgNBAWo2AgAgAiAENgIMIAEoAhAiASgCBCIFIANNDQEgACABKAIAIANqIAQQwwEgAkEMahDVBwsgAkEQaiQADwsgAyAFQdzlwQAQ/wMAC4EBAQN/IwBBIGsiBCQAIARBGGogARD7BSAEKAIcIQUgBCgCGCEBIARBEGogAiADENIFIARBCGogASAEKAIQIgIgBCgCFCIDEJkDIAQoAgwhBiAEKAIIIQEgAwRAIAIQfgsgBUEANgIAIAAgATYCBCAAIAZBACABGzYCACAEQSBqJAALowEBAX8jAEHQAGsiAyQAIANBQGtCADcDACADQgA3AzggAyABNwMwIAMgAULzytHLp4zZsvQAhTcDICADIAFC7d6R85bM3LfkAIU3AxggAyAANwMoIAMgAELh5JXz1uzZvOwAhTcDECADIABC9crNg9es27fzAIU3AwggAyACNgJMIANBCGoiAiADQcwAakEEEJkCIAIQ5wEhACADQdAAaiQAIAALgAECA38BfiMAQRBrIgQkACAEQQhqIAEgAmsiA0EAEJEEIAQpAwghBiAAQQA2AgggACAGNwIAIAAgAxCkByAAKAIIIQMgACgCBCEFA0AgASACRwRAIAMgBWogAi0AADoAACADQQFqIQMgAkEBaiECDAELCyAAIAM2AgggBEEQaiQAC4YBAQF/IwBBgANrIgEkACAAEJsIIAEgABDoBiABKAIEQQA2AgAgAUHAAWogAEHAARCSCRogAUEIaiABQcgBakG4ARCSCRogABB+IAFBgAFqEMYBIAFBhAFqEPkGIAFBiAFqEPkGIAFBjAFqEPkGIAFBkAFqEOwHIAFBGGoQtAQgAUGAA2okAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakECNgIAIANBHGpBAjYCACADQSxqQQE2AgAgA0GcnsAANgIQIANBADYCCCADQQE2AiQgAyADQSBqNgIYIAMgAzYCKCADIANBBGo2AiAgA0EIaiACEIEGAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakEDNgIAIANBHGpBAjYCACADQSxqQQE2AgAgA0HwksAANgIQIANBADYCCCADQQE2AiQgAyADQSBqNgIYIAMgA0EEajYCKCADIAM2AiAgA0EIaiACEIEGAAt3AQF/IwBBMGsiAyQAIAMgATYCBCADIAA2AgAgA0EUakEDNgIAIANBHGpBAjYCACADQSxqQQE2AgAgA0HQpMAANgIQIANBADYCCCADQQE2AiQgAyADQSBqNgIYIAMgAzYCKCADIANBBGo2AiAgA0EIaiACEIEGAAt9AgF/AX4jAEEQayIDJAAgA0EIaiAAKAIIIAEgAhD4BCADLQAIIgJBBEcEQCADKQMIIQQgAC0AAEEDRgRAIAAoAgQiASgCACABKAIEKAIAEQEAIAEoAgQoAgQEQCABKAIAEH4LIAEQfgsgACAENwIACyADQRBqJAAgAkEERwuKAQEEfyMAQRBrIgEkAAJ/QYSdwgAoAgAiAARAQYidwgBBACAAGwwBCxDXBSEDQYSdwgAoAgAhAEGEncIAQQE2AgBBiJ3CACgCACECQYidwgAgAzYCACABIAI2AgwgASAANgIIIABFIAJFckUEQCABQQhqQQRyEPgGC0GIncIACyEAIAFBEGokACAAC4IBAQR/IAEoAgAiAiABKAIIIgNLBEAgAkEYbCECIAEoAgQhBAJ/AkAgA0UEQCAEIAIQpAhBCCECDAELQQggBCACQQggA0EYbCIFEHYiAkUNARoLIAEgAzYCACABIAI2AgRBgYCAgHgLIQIgBSACEKkHCyAAIAM2AgQgACABKAIENgIAC38BA38jAEEgayIEJAAgBEEYaiABEPsFIAQoAhwhBSAEKAIYIQEgBEEQaiACIAMQ0gUgBEEIaiABIAQoAhAiAiAEKAIUIgMQmQMgBCgCDCEGIAQoAgghASADIAIQhgggBUEANgIAIAAgATYCBCAAIAZBACABGzYCACAEQSBqJAALdgEBf0EYIQQCQCABIAJNDQAgACACQdAAbGoiACgCAEEBRw0AIABBHGooAgAiBCAAKAIURgRAIABBFGogBBD8AiAAKAIcIQQLIABBGGooAgAgBEECdGogAzYCACAAQgA3AzAgACAAKAIcQQFqNgIcQRkhBAsgBAvGAQEFfyAAKAIEIQEgAEGolcIANgIEIAAoAgAhAiAAQaiVwgA2AgACQCABIAJGDQAgAiABa0EMbkEMbCECIAAoAhAoAgQiAyABIANrQQxuQQxsaiEBA0AgAkUNASABQQhqEPgGIAJBDGshAiABQQxqIQEMAAsACyAAKAIMIgEEQCAAKAIIIgQgACgCECICKAIIIgNHBEAgAigCBCIFIANBDGxqIAUgBEEMbGogAUEMbBCUCRogACgCDCEBCyACIAEgA2o2AggLC9YBAgF/An4jAEEgayIDJAAgACkDCCEEIAMgAq0iBTcDACAEIAVRBEAgACgCECAAKQMAIAEgAhCgAyEAIANBIGokACAADwsgA0EANgIcIANBqJXCADYCGCADQQE2AhQgA0G4kMAANgIQIANBADYCCCMAQSBrIgEkACABIABBCGo2AgQgASADNgIAIAFBGGogA0EIaiIAQRBqKQIANwMAIAFBEGogAEEIaikCADcDACABIAApAgA3AwggAUGg4MEAIAFBBGpBoODBACABQQhqQcCQwAAQ0gEAC3QBAX9BDBBQIgYEQCAGQQI2AgggBiADNgIAIAYgBCADayAFajYCBCABIAYgASgCACIBIAEgAkYiAhs2AgAgAgRAIABBhJTAADYCDCAAIAY2AgggACAFNgIEIAAgBDYCAA8LIAAgASAEIAUQ2gUgBhB+DwsAC3oBAn8jAEEgayICJAAgAkEIaiABECsCQCACKAIIIgMEQCACKAIMIQEgAiADNgIUIAIgATYCGCACIAE2AhAgAiACQRBqEPYEIAIoAgAhASAAIAIoAgQiAzYCCCAAIAE2AgQgACADNgIADAELIABBADYCBAsgAkEgaiQAC3cCAn8BfiMAQSBrIgMkACADQRhqIgQgAUEIaigCADYCACADIAEpAgA3AxAgA0EIaiADQRBqIgEQnQUgAykDCCEFIAQgAkEIaigCADYCACADIAIpAgA3AxAgAyABEJ0FIAAgAykDADcCCCAAIAU3AgAgA0EgaiQAC3QBAn8gAqchA0EIIQQDfyABIAAgA3EiA2opAABCgIGChIiQoMCAf4MiAlAEfyADIARqIQMgBEEIaiEEDAEFIAEgAnqnQQN2IANqIABxIgRqLAAAQQBOBH8gASkDAEKAgYKEiJCgwIB/g3qnQQN2BSAECwsLC2oBAX8jAEEwayICJAAgAkEoaiABQRhqKAIANgIAIAJBIGogAUEQaikCADcDACACQRhqIAFBCGopAgA3AwAgAiABKQIANwMQIAJBCGogAkEQahDxBCAAIAIoAgggAigCDBDnAiACQTBqJAALbQECfyMAQSBrIgIkAAJ/IAEoAgQEQCACQRhqIAFBCGooAgA2AgAgAiABKQIANwMQIAJBCGogAkEQahCdBSAAIAIpAwg3AgBBAAwBC0EBIQMgASgCAAshASAAIAM2AgwgACABNgIIIAJBIGokAAt3AgJ/AX4jAEEwayIDJAAgA0EQaiABIAIQhQMgAykDECEFIAMoAhghAiADQSBqIgQgASgCbCIBQYACaigCAEEIahDQBSADQQhqIAQQwgUgACADKQMINwIUIAAgAUEIajYCECAAIAI2AgggACAFNwMAIANBMGokAAuaAQEBfwJAAkACQAJAIABBAWsOAwECAwALIAEgAkEwaigCACACQTRqKAIAEOUGQRBqDwsgASACQRhqKAIAIAJBHGooAgAQ5QZBEGoPCyABIAJBDGooAgAgAkEQaigCABDlBkEQag8LIAJBJGooAgAhAyABQQFrIgAgAkEoaigCACIBTwRAIAAgAUHc2MEAEP8DAAsgAEEDdCADagtuAQF/IwBBEGsiAyQAAkAgAUUEQEEBIQIMAQsgAUEATgRAAn8gAkUEQCADQQhqIAFBARDtBSADKAIIDAELIAMgAUEBQQEQ2QYgAygCAAsiAg0BAAsQxgUACyAAIAI2AgQgACABNgIAIANBEGokAAtyAQV/IAAoAgghAiAAKAIEIQEgACgCACEDA0ACQCABIANGBEBBACEBDAELIAAgAUEEaiIENgIEIAEoAgAiBSACKAIAIgFBEGooAgBJBEAgAUEMaigCACAFQdAAbGoiASgCAEECRw0B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AABBASEBDAELIAFBfzYCABCzByEDIAIgATYCBCACQQhqIgQgA0EBczoAACACIAEtAARBAEc2AgAgAigCACEBIAIoAgQhAyAAQQhqIAQtAAA6AAAgACADNgIECyAAIAE2AgAgAkEQaiQAC24BAn8jAEEQayICJAAgARC5ByACIAFBBGoQvAcgAi0AAUEBcSEDIAItAABBAXEEQCACIAM6AAwgAiABNgIIQbD7wQBBKyACQQhqQeiNwQBB6I7BABDpAwALIAAgAzoABCAAIAE2AgAgAkEQaiQAC3EBAX8gAEHwAGooAgAgAEH0AGooAgAQ0wcgAEEQahC5AyAAQcgAaigCACAAQdQAaigCABDdByAAQSRqKAIAIABBKGooAgAQhgggACgCYCAAQeQAaiIBKAIAKAIAEQEAIAEoAgAoAgQEQCAAKAJgEH4LC2EBAX8gAiABKAIIIgRJBEAgACABKAIEIAJBDGxqIgMpAgA3AgAgAEEIaiADQQhqKAIANgIAIAMgA0EMaiAEIAJBf3NqQQxsEJQJGiABIARBAWs2AggPCyACIAQgAxCABAALZAEBfyMAQSBrIgMkACADIAE2AgQgAyAANgIAIANBGGogAkEQaikCADcDACADQRBqIAJBCGopAgA3AwAgAyACKQIANwMIIANBxL/AACADQQRqQcS/wAAgA0EIakG0v8AAENIBAAthAQF/IwBBIGsiBCQAIAQgATYCBCAEIAA2AgAgBEEYaiACQRBqKQIANwMAIARBEGogAkEIaikCADcDACAEIAIpAgA3AwggBEGUwMAAIARBBGpBlMDAACAEQQhqIAMQ0gEAC2cBAX8jAEEgayICJAAgAkGE88EANgIEIAIgADYCACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQcjBwAAgAkEEakHIwcAAIAJBCGpBqM3AABDSAQALZwEBfyMAQSBrIgIkACACQYTzwQA2AgQgAiAANgIAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBtNTAACACQQRqQbTUwAAgAkEIakHk3sEAENIBAAt3AQF/IwBBEGsiAiQAIAIgACgCACIAQQhqNgIEIAIgADYCCCACIABBDGo2AgwgAUGU6MAAQQpB5efAAEEHIAJBBGpBoOjAAEH858AAQQcgAkEIakGw6MAAQfDlwABBBiACQQxqQcDowAAQiQMhACACQRBqJAAgAAt3AQF/IwBBEGsiAiQAIAIgACgCACIAQQxqNgIEIAIgAEEIajYCCCACIAA2AgwgAUHc58AAQQlB3LTBAEECIAJBBGpBsOfAAEHl58AAQQcgAkEIakHs58AAQfznwABBByACQQxqQYTowAAQiQMhACACQRBqJAAgAAthAQF/IwBBIGsiBCQAIAQgATYCBCAEIAA2AgAgBEEYaiACQRBqKQIANwMAIARBEGogAkEIaikCADcDACAEIAIpAgA3AwggBEGMhsEAIARBBGpBjIbBACAEQQhqIAMQ0gEAC2EBAX8jAEEgayIEJAAgBCABNgIEIAQgADYCACAEQRhqIAJBEGopAgA3AwAgBEEQaiACQQhqKQIANwMAIAQgAikCADcDCCAEQYC+wQAgBEEEakGAvsEAIARBCGogAxDSAQALXgECfyAAIAEoAggiAkEHakF4cWogASgCABEBAAJAIABBf0YNACAAIAAoAgQiA0EBazYCBCADQQFHDQBBBCACIAJBBE0bIgIgASgCBGpBB2pBACACa3FFDQAgABB+CwtfAQF/IAApAwBCAFIEQCAAQUBrEPoFIABBIGooAgAiAQRAIABBLGooAgAgAUECdEELakF4cWsQfgsgAEE0aiIBKAIAIABBOGooAgAQmQkgAEEwaigCACABKAIAENwHCwteAQF/IwBBIGsiAiQAIAIgACgCADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQeCQwAAgAkEIahCTASEAIAJBIGokACAAC1wBAn8jAEEgayICJAAgASgCBCEDIAEoAgAhASACQRhqIABBEGopAgA3AwAgAkEQaiAAQQhqKQIANwMAIAIgACkCADcDCCABIAMgAkEIahCTASEAIAJBIGokACAAC14BAX8jAEEgayICJAAgAiAAKAIANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB7KHAACACQQhqEJMBIQAgAkEgaiQAIAALOwECfyMAQRBrIgEkACABQQhqQeABQQgQowcgASgCCCICBEAgACACNgIEIABBBDYCACABQRBqJAAPCwALVwEBfwJAAkACQEECIAAoAhAiAUECayABQQJJGw4DAAIBAgsgAEEEaigCACAAQQhqKAIAEIYIDwsgABCZByAAQRBqEJkHDwsgACgCACAAQQRqKAIAEIYIC2MBAX8jAEEQayIFJAAgBSABIAMgBCACKAIoEQUAAkAgBSgCCARAIAAgBSkDADcCACAAQQhqIAVBCGopAwA3AgAMAQsgBS0AACEBIABBADYCCCAAIAEQ7gc6AAALIAVBEGokAAtoAQJ/IwBBEGsiAiQAIAJBCGogARCDBwJAIAIoAggiAUUEQCAAQQA2AgQMAQsgAigCDCEDIAAgAUEEaigCACABQQhqKAIAEJQFIABBGGogAygCCDYCACAAIAMpAwA3AxALIAJBEGokAAtbAQF/IwBBIGsiAiQAIAIgADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQeyhwAAgAkEIahCTASEAIAJBIGokACAAC2EBAX8jAEEgayICJAAgAkEYakIANwMAIAJCADcDECACIAEgAkEQahD8AQJAIAIoAgBFBEAgAEEEOgAADAELIAIoAgQhASAAIAJBCGooAgA2AgQgACABNgIACyACQSBqJAALWwEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGYgMEAIAJBCGoQkwEhACACQSBqJAAgAAtbAQF/IwBBIGsiAiQAIAIgADYCBCACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCACQQRqQfCiwQAgAkEIahCTASEAIAJBIGokACAAC1sBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpBiKPBACACQQhqEJMBIQAgAkEgaiQAIAALWwEBfyMAQSBrIgIkACACIAA2AgQgAkEYaiABQRBqKQIANwMAIAJBEGogAUEIaikCADcDACACIAEpAgA3AwggAkEEakGgo8EAIAJBCGoQkwEhACACQSBqJAAgAAtyAQF/IwBBEGsiAiQAIAIgADYCBCACIABBCGo2AgggAiAAQRBqNgIMIAFBsLnBAEEeQc65wQBBAyACQQRqQdS5wQBB5LnBAEEKIAJBCGpB8LnBAEGAusEAQQ4gAkEMakGQusEAEIkDIQAgAkEQaiQAIAALXQECfyAAKAIIQRRsIQIgACgCBCEBA0AgAgRAIAEtAABFBEAgAUEEahCECCABQQxqEIQICyABQRRqIQEgAkEUayECDAELCyAAKAIAIgEEQCAAKAIEIAFBFGwQpAgLC2EBAn8gACgCCCAAKAIEIgFrQRhuQRhsIQIDQCACBEAgASgCACABQQRqKAIAEIYIIAFBDGooAgAgAUEQaigCABCGCCACQRhrIQIgAUEYaiEBDAELCyAAKAIAIAAoAgwQzQcLXQIBfwF+IwBBIGsiAyQAIAEpAwAhBCADQRhqIAJBEGooAgA2AgAgA0EQaiACQQhqKQIANwMAIAMgAikCADcDCCAAIAEgA0EIahD3AzYCCCAAIAQ3AwAgA0EgaiQAC1sBAX8jAEEgayICJAAgAiAANgIEIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAJBBGpB2N/BACACQQhqEJMBIQAgAkEgaiQAIAALhQEBAn8gACgCCCICIAAoAgBGBEAjAEEQayIDJAAgA0EIaiAAIAJBARD2AiADKAIIIAMoAgwQqQcgA0EQaiQAIAAoAgghAgsgACACQQFqNgIIIAAoAgQgAkEYbGoiACABKQMANwMAIABBCGogAUEIaikDADcDACAAQRBqIAFBEGopAwA3AwALYgEBfyAAKAIEKAIMIAFBAnRrQQRrKAIAIgEgACgCACIAQQxqKAIAIgJPBEAgASACQezbwAAQ/wMACyAAKAIAIAAoAgQgACgCCCABQShsaiIAQSBqKAIAIABBJGooAgAQmwcLZAEBfyAAKAIEKAIMIAFBAnRrQQRrKAIAIgEgACgCACIAKAIEIgJPBEAgASACQezbwAAQ/wMACyAAKAIIIgIoAgQgAigCCCAAKAIAIAFBKGxqIgBBIGooAgAgAEEkaigCABCbBwv4AwEKfyMAQSBrIgUkACAAKAIIQQJHBEAgBSAANgIAIAUgADYCBCAFIAVBGGo2AhAgBSAFQQRqNgIMIAUgBTYCCCAFQQhqIQcjAEEgayICJAAgAEEIaiIEKAIAIQECQAJAAkACQANAAkACQAJAIAFBA3EiCA4DAAEEAwsgBw0BCyACQQhqIAhyIQkCQANAAkAQ3QIhCiAEIAkgBCgCACIDIAEgA0YiBhs2AgAgAkEAOgAQIAIgCjYCCCACIAFBfHE2AgwgBg0AIAJBCGoQjAggAyIBQQNxIAhGDQEMAgsLA0AgAi0AEEUEQBC0AQwBCwsgAkEIahCMCAsgBCgCACEBDAELIAQgAUF8cUEBciAEKAIAIgMgASADRhs2AgAgASADRyEGIAMhASAGDQALIAdBrNzAACgCABEGACEDIAQoAgAhASAEQQJBACADGzYCACACIAFBA3EiAzYCBCADQQFHDQEgAUEBayEBA0AgAUUNASABKAIEIQMgASgCACEEIAFBADYCACAERQ0DIAFBAToACCACIAQ2AgggBEEQahD5ASACQQhqEO0GIAMhAQwACwALIAJBIGokAAwCCyACQQA2AhAgAkEEakGkwMAAIAJBCGpBiMHAABCsBAALQff4wQBBK0GYwcAAEJEFAAsLIAVBIGokACAAQQRqC1kBAn8jAEEQayICJAACQCABRQRAQQEhAwwBCyABQQBOBEAgAkEIaiABIAFBf3NBH3YQowcgAigCCCIDDQEACxDGBQALIAAgAzYCBCAAIAE2AgAgAkEQaiQAC7oBAQF/IwBBIGsiAiQAAkAgAUH/AXENABCzBw0AIABBAToABAsgACgCACEBIABBADYCACACIAE2AgQgAUF/RwRAIAJBADYCECMAQSBrIgAkACAAQci2wQA2AgQgACACQQRqNgIAIABBGGogAkEIaiIBQRBqKQIANwMAIABBEGogAUEIaikCADcDACAAIAEpAgA3AwggAEGchsEAIABBBGpBnIbBACAAQQhqQbS3wQAQ0gEACyACQSBqJAALXgEBfyMAQRBrIgMkAAJAAkACQCABQQJrDgIAAQILQQIhAQwBCyACIQELIAAgACgCCCIAIAEgABs2AghBBCEBIAAEQCADQQhqIAAQvQcgAygCCCEBCyADQRBqJAAgAQtSAQJ/IABBKGooAgAiAkEBahDrByEDIAAgACgCICACRwR/IAMFIABBIGogAhD9AiAAKAIoIgJBAWoLNgIoIABBJGooAgAgAkEDdGogATcCACADC2MBAX8jAEEQayIDJAAgASgCAEUEQCAAIAEoAgQ2AgAgACABQQhqLQAAOgAEIANBEGokAA8LIAMgASgCBDYCCCADIAFBCGotAAA6AAxBsPvBAEErIANBCGpBzI/AACACEOkDAAtjAQF/IwBBEGsiAyQAIAEoAgBFBEAgACABKAIENgIAIAAgAUEIai0AADoABCADQRBqJAAPCyADIAEoAgQ2AgggAyABQQhqLQAAOgAMQbD7wQBBKyADQQhqQdyPwAAgAhDpAwALYwEBfyMAQRBrIgMkACABKAIARQRAIAAgASgCBDYCACAAIAFBCGotAAA6AAQgA0EQaiQADwsgAyABKAIENgIIIAMgAUEIai0AADoADEGw+8EAQSsgA0EIakH8j8AAIAIQ6QMAC2UAAkACQAJAIAAoAgAOAwACAQILIABBCGooAgAgAEEMaigCABCGCCAAQcQAaigCACAAQcgAaigCABCGCAsPCyAAQQhqKAIAIABBDGooAgAQhgggAEEUaigCACAAQRhqKAIAENMHC1IAIANBA3QhAyACQQRqIQIgACABAn8DQCADRQRAQQAhAEGolcIADAILIANBCGshAyACKAIAIQAgAkEIaiECIABFDQALIAJBDGsoAgALIAAQuAELUgAgA0EDdCEDIAJBBGohAiAAIAECfwNAIANFBEBBACEAQaiVwgAMAgsgA0EIayEDIAIoAgAhACACQQhqIQIgAEUNAAsgAkEMaygCAAsgABCKAQtTAQF/IwBBIGsiAiQAIAAoAgAhACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCAAIAJBCGoQvgQhACACQSBqJAAgAAtjAQF/IwBBEGsiAyQAIAEoAgBFBEAgACABKAIENgIAIAAgAUEIai0AADoABCADQRBqJAAPCyADIAEoAgQ2AgggAyABQQhqLQAAOgAMQbD7wQBBKyADQQhqQciGwQAgAhDpAwALYwEBfyMAQRBrIgMkACABKAIARQRAIAAgASgCBDYCACAAIAFBCGotAAA6AAQgA0EQaiQADwsgAyABKAIENgIIIAMgAUEIai0AADoADEGw+8EAQSsgA0EIakHYhsEAIAIQ6QMAC2MBAX8jAEEQayIDJAAgASgCAEUEQCAAIAEoAgQ2AgAgACABQQhqLQAAOgAEIANBEGokAA8LIAMgASgCBDYCCCADIAFBCGotAAA6AAxBsPvBAEErIANBCGpBmI3BACACEOkDAAtjAQF/IwBBEGsiAyQAIAEoAgBFBEAgACABKAIENgIAIAAgAUEIai0AADoABCADQRBqJAAPCyADIAEoAgQ2AgggAyABQQhqLQAAOgAMQbD7wQBBKyADQQhqQciNwQAgAhDpAwALUgAgA0EDdCEDIAJBBGohAiAAIAECfwNAIANFBEBBACEAQaiVwgAMAgsgA0EIayEDIAIoAgAhACACQQhqIQIgAEUNAAsgAkEMaygCAAsgABCaAwtSACADQQN0IQMgAkEEaiECIAAgAQJ/A0AgA0UEQEEAIQBBqJXCAAwCCyADQQhrIQMgAigCACEAIAJBCGohAiAARQ0ACyACQQxrKAIACyAAEMYHC1MBAX8jAEEgayICJAAgACgCACEAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAAgAkEIahC/BCEAIAJBIGokACAAC1MBAX8jAEEgayICJAAgACgCACEAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAAgAkEIahDABCEAIAJBIGokACAAC1MBAX8jAEEgayICJAAgACgCACEAIAJBGGogAUEQaikCADcDACACQRBqIAFBCGopAgA3AwAgAiABKQIANwMIIAAgAkEIahDBBCEAIAJBIGokACAAC10BBH8gASgCCEEMbCEDIAEoAgQhBEF/IQUCQANAIANFDQEgA0EMayEDIAVBAWohBSAEKAIAIQYgBEEMaiEEIAIgBkcNAAsgACABIAVBoPvBABCqBA8LIABBADYCCAtjAQF/IwBBEGsiAyQAIAEoAgBFBEAgACABKAIENgIAIAAgAUEIai0AADoABCADQRBqJAAPCyADIAEoAgQ2AgggAyABQQhqLQAAOgAMQbD7wQBBKyADQQhqQdywwQAgAhDpAwALUgAgA0EDdCEDIAJBBGohAiAAIAECfwNAIANFBEBBACEAQaiVwgAMAgsgA0EIayEDIAIoAgAhACACQQhqIQIgAEUNAAsgAkEMaygCAAsgABDVAgtTAQF/IwBBIGsiAiQAIAAoAgAhACACQRhqIAFBEGopAgA3AwAgAkEQaiABQQhqKQIANwMAIAIgASkCADcDCCAAIAJBCGoQxgQhACACQSBqJAAgAAtSACADQQN0IQMgAkEEaiECIAAgAQJ/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AxAgACABKQMYNwMYIABBJmogAUEmai0AADoAACAAQSRqIAFBJGovAQA7AQALUwEBfyACIAEoAggiA0sEQCACIANB4KLBABDNCAALIAFBADYCCCAAIAI2AgggACABNgIQIAAgAyACazYCDCAAIAEoAgQiATYCBCAAIAEgAmo2AgALTAEBfyAAKAIIIgEgASgCACIBQQFrNgIAIAFBAUYEQCAAKAIIEOwCCwJAIABBf0YNACAAIAAoAgQiAUEBazYCBCABQQFHDQAgABB+CwtMAgF/AX4jAEEQayIDJAAgA0EIaiAAKAIIIAEgAhC8AyADLQAIIgFBBEcEQCADKQMIIQQgABD1ByAAIAQ3AgALIANBEGokACABQQRHC0YAIAEoAgAiAUEBcQRAIAEgBBEGACACIAMQlAkhASAAIAM2AgggACABNgIEIAAgAiADaiABazYCAA8LIAAgASACIAMQ4gMLSwECfyMAQRBrIgEkACABQQhqIANBABCRBCABKAIIIQQgACABKAIMIgU2AgQgACAENgIAIAUgAiADEJIJGiAAIAM2AgggAUEQaiQAC0oBAX8CQCABLQAUQQdHBEBBACEBDAELIAEoAgAiAkEMaigCAEEAIAIoAghBAUYbIQEgAkEQaigCACECCyAAIAI2AgQgACABNgIAC0UBAX8jAEEgayICJAAgAkEYaiABQQhqKAIANgIAIAIgASkCADcDECACQQhqIAJBEGoQ9gQgACACKQMINwMAIAJBIGokAAtTAQF/IAAgAUEYaigCADYCGCAAIAFBHGooAgAiAjYCECAAIAJBCGo2AgggACACIAEoAhBqQQFqNgIMIAAgAikDAEJ/hUKAgYKEiJCgwIB/gzcDAAtPAQF/IAEoAgAiASABKAIAIgJBAWo2AgAgAkEASARAAAsQ2AchAiAAQQA2AgggAEHw6sAANgIEIAAgAjYCACACIAE2AgAgAEEMakEAOwEAC00BAX8jAEEQayIBJAAgASABIAEQpQYCQCABKAIARQRAIABBBDoAAAwBCyABKAIEIQIgACABQQhqKAIANgIEIAAgAjYCAAsgAUEQaiQAC00BAX8jAEEQayIBJAAgASABIAEQpAYCQCABKAIARQRAIABBBDoAAAwBCyABKAIEIQIgACABQQhqKAIANgIEIAAgAjYCAAsgAUEQaiQAC00BAX8jAEEQayIBJAAgASABIAEQogYCQCABKAIARQRAIABBBDoAAAwBCyABKAIEIQIgACABQQhqKAIANgIEIAAgAjYCAAsgAUEQaiQAC0cBAX4jAEEQayIBJAAgAUEIaiABIAEgARDLBiABLQAIIgJBBEcEQCABKQMIIQMgABDsBSAAIAM3AgALIAFBEGokACACQQRHC0oBAX8jAEFAaiIDJAACQCACIAEgA0HAABCTBSICQf8BcUEDRgRAIAAgA0HAABCSCRoMAQsgAEEJOgAQIAAgAjoAAAsgA0FAayQAC00BAX8jAEEQayIBJAAgASABIAEQpwYCQCABKAIARQRAIABBBDoAAAwBCyABKAIEIQIgACABQQhqKAIANgIEIAAgAjYCAAsgAUEQaiQAC0kBA38jAEEQayIDJAAgA0EIaiACEMsEIAMoAgghBCAAIAMoAgwiBTYCBCAAIAQ2AgAgBSABIAIQkgkaIAAgAjYCCCADQRBqJAALSAEBfyACIAAoAgAiACgCACAAKAIIIgNrSwRAIAAgAyACEIEDIAAoAgghAwsgACgCBCADaiABIAIQkgkaIAAgAiADajYCCEEAC04BAX8jAEEQayIAJAAgASgCAEGF88EAQQsgASgCBCgCDBEEACECIABBADoADSAAIAI6AAwgACABNgIIIABBCGoQrAMhASAAQRBqJAAgAQtOAQF/IwBBEGsiACQAIAEoAgBB2MHAAEELIAEoAgQoAgwRBAAhAiAAQQA6AA0gACACOgAMIAAgATYCCCAAQQhqEJoEIQEgAEEQaiQAIAELQAAgACABaiEBIAMoAgBBAWohAANAIAIEQCADIAA2AgAgAUEAOgAAIAFBAWohASAAQQFqIQAgAkEBayECDAELCwtNAQF/IAAoAgAgACgCBCgCABEBACAAKAIEKAIEBEAgACgCABB+CyAAKAIIIABBDGoiASgCACgCABEBACABKAIAKAIEBEAgACgCCBB+Cws+AQF/AkAgASADTQ0AIAAgA0GQAmxqQQAgASADSxsiAC0AjAJBAkYNACAAQQhqQQAgACkDACACURshBAsgBAshAQF/QeAAQQQQ1AciAQRAIAAgATYCBCAAQQQ2AgAPCwALSQEBfwJAAkAgAUH///8fSw0AIAFBBXQiAkEASA0AIAIgAUGAgIAgSUEDdBDUByICRQ0BIAAgAjYCBCAAIAE2AgAPCxDGBQALAAtIAQJ/IwBBIGsiAiQAIAJBGGoiAyABENEBIAIgAikDGDcDGCACQQhqIAMQ9gUgACACKQIMNwIEIAAgAigCCDYCACACQSBqJAALTQICfwF+IwBBEGsiASQAIAFBCGogABD3BSABKAIMIQAgASgCCCICKAIAIAIoAgQoAngRBwAhAyAAIAAoAgBBAWs2AgAgAUEQaiQAIAMLTQICfwF+IwBBEGsiASQAIAFBCGogABD3BSABKAIMIQAgASgCCCICKAIAIAIoAgQoAnwRBwAhAyAAIAAoAgBBAWs2AgAgAUEQaiQAIAMLTgICfwF+IwBBEGsiASQAIAFBCGogABD3BSABKAIMIQAgASgCCCICKAIAIAIoAgQoAoABEQcAIQMgACAAKAIAQQFrNgIAIAFBEGokACADC04CAn8BfiMAQRBrIgEkACABQQhqIAAQ9wUgASgCDCEAIAEoAggiAigCACACKAIEKAKEAREHACEDIAAgACgCAEEBazYCACABQRBqJAAgAwtHACABKAIAQQJGBEAgACACKQIANwIAIABBCGogAkEIaikCADcCAA8LIAAgASkCADcCACAAQQhqIAFBCGopAgA3AgAgAhCZBwtGAQJ/IwBBIGsiASQAIAFBGGoiAhCHByABIAEpAxg3AxggAUEIaiACEPYFIAAgASkCDDcCBCAAIAEoAgg2AgAgAUEgaiQAC0cBAX8CQCAAKAIYRQ0AA0AgABDmAyIBRQ0BIAFBMGsQhQcMAAsACwJAIABBKGooAgBFDQAgAEEkaigCAEUNACAAKAIgEH4LCz8AAkAgASACTQRAIAIgBE0NASACIAQgBRDNCAALIAEgAiAFEM4IAAsgACACIAFrNgIEIAAgAyABQQV0ajYCAAs/AAJAIAEgAk0EQCACIARNDQEgAiAEIAUQzQgACyABIAIgBRDOCAALIAAgAiABazYCBCAAIAMgAUEYbGo2AgALQQEBfyABKAIAIgIgASgCBE8Ef0EABSABIAJBAWo2AgAgASgCCCgCACACEAwhAUEBCyECIAAgATYCBCAAIAI2AgALQwECfyMAQRBrIgMkACABIAIQDSEBIANBCGoQ4AYgAygCDCECIAAgAygCCCIENgIAIAAgAiABIAQbNgIEIANBEGokAAtDAQJ/IwBBEGsiAyQAIAEgAhAfIQEgA0EIahDgBiADKAIMIQIgACADKAIIIgQ2AgAgACACIAEgBBs2AgQgA0EQaiQAC0MBAn8jAEEQayIDJAAgASACECEhASADQQhqEOAGIAMoAgwhAiAAIAMoAggiBDYCACAAIAIgASAEGzYCBCADQRBqJAALQwEBfyMAQRBrIgMkACADIAEgAhB8IAMoAgQhASADKAIAIQIgACADQQhqKAIANgIEIABBACABIAIbNgIAIANBEGokAAtKAgF/AX4jAEEQayICJAAgAC0AAEUEQCAAKQMIIQMgAkEQaiQAIAMPCyACIAAtAAE6AA9BsPvBAEErIAJBD2pB+IbBACABEOkDAAtKAgF/AX4jAEEQayICJAAgAC0AAEUEQCAAKQMIIQMgAkEQaiQAIAMPCyACIAAtAAE6AA9BsPvBAEErIAJBD2pBwKzBACABEOkDAAtJAQF/IwBBEGsiAyQAIAEoAgBFBEAgACABKQIENwMAIANBEGokAA8LIAMgASkCBDcDCEGw+8EAQSsgA0EIakG4jcEAIAIQ6QMAC0UBAn8gACgCBCIAKAIEIgIgACgCDCIBSQRAIAEgAkGk3cEAEMkIAAsgACgCACABakEAIAIgAWsQkQkaIAAgACgCBDYCDAtMAQF/IwBBEGsiAiQAIAEoAgBFBEAgACABKQIENwMAIAJBEGokAA8LIAIgASkCBDcDCEGw+8EAQSsgAkEIakHQrMEAQbSuwQAQ6QMAC0UBAX8gACgCCCIDIAAoAgBGBEAgACADEP0CIAAoAgghAwsgACADQQFqNgIIIAAoAgQgA0EDdGoiACACNgIEIAAgATYCAAtCAQJ/IwBBEGsiAiQAIAEgACgCACAAKAIIIgNrSwRAIAJBCGogACADIAEQ9gIgAigCCCACKAIMEKkHCyACQRBqJAALPQAgASgCBARAIAAgASkCADcCACAAQQhqIAFBCGooAgA2AgAPCyABLQAAIQEgAEEANgIEIAAgARCICDoAAAtKAQF/IwBBIGsiACQAIABBFGpBATYCACAAQRxqQQA2AgAgAEGglcIANgIQIABBqJXCADYCGCAAQQA2AgggAEEIakGUkcAAEIEGAAtFAgF+AX8gACgCACEAIAEoAhgiA0EQcUUEQCAAKQMAIQIgA0EgcUUEQCACIAEQ7AgPCyACIAEQ3wIPCyAAKQMAIAEQ3gILSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABBiOPAADYCECAAQaiVwgA2AhggAEEANgIIIABBCGpBwL7AABCBBgALQQEDfyMAQRBrIgIkACABECIhASACQQhqEOAGIAIoAgwhAyAAIAIoAggiBDYCACAAIAMgASAEGzYCBCACQRBqJAALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB+MrAADYCECAAQaiVwgA2AhggAEEANgIIIABBCGpBsMvAABCBBgALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABB+MrAADYCECAAQaiVwgA2AhggAEEANgIIIABBCGpBwMvAABCBBgALSgEBfyMAQSBrIgAkACAAQRRqQQE2AgAgAEEcakEANgIAIABBiOPAADYCECAAQaiVwgA2AhggAEEANgIIIABBCGpB8OPAABCBBgALPAACQCABIAJNBEAgAiAETQ0BIAIgBCAFEM0IAAsgASACIAUQzggACyAAIAIgAWs2AgQgACABIANqNgIACzoBAX8gAEEYaigCAARAIABBEGogACkDACAAQQhqKQMAIAEoAgAQ/AMgARD1AyECCyACQQhqQQAgAhsLPQAgAiADTwRAIAAgAzYCBCAAIAE2AgAgAEEMaiACIANrNgIAIAAgASADajYCCA8LQZCBwQBBIyAEEJEFAAs9AQF/IAEoAgAiAkEASARAAAsgASACQQFqNgIAIABBCGogATYCACAAIAFBCGo2AgQgACABLQAEQQBHNgIACzoBA38DQCACQRhHBEAgACACaiIDKAIAIQQgAyABIAJqIgMoAgA2AgAgAyAENgIAIAJBBGohAgwBCwsLQAEBfyMAQSBrIgMkACADIAI2AhggAyABNgIUIAMgAjYCECADQQhqIANBEGoQ9gQgACADKQMINwMAIANBIGokAAtAAQF/IAAoAgAoAgAiAkEEaigCACACQQhqKAIAIAAoAgQoAgwgAUEFdGtBIGsiAEEEaigCACAAQQhqKAIAEOgIC0MCAX8BfiMAQRBrIgUkACAFQQhqIAEgAhD8BSAFKQMIIQYgBSADIAQQ/AUgACAFKQMANwIIIAAgBjcCACAFQRBqJAALPQEBfyAAIAAoAggiAUEBazYCCCABQQFGBEAgACgCACEB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QbD7wQBBKyADQQxqQaDGwQAgAhDpAwALOAEBfyAAKAIYEIsIIABBIGooAgAiAQRAIAAoAhwgARCGCAsgACgCBARAIAAQwwQgAEEMahDDBAsLOwEBfyMAQRBrIgIkACABEJsIIAJBCGogARDoBiACKAIMIQEgACACKAIINgIAIAAgATYCBCACQRBqJAALOgEBfyMAQRBrIgMkACADQQhqIAIQywQgAygCDCABIAIQkgkhASAAIAI2AgQgACABNgIAIANBEGokAAs+AQF/IwBBEGsiAiQAIABFBEAgAkEQaiQAIAEPCyACIAE2AgxBsPvBAEErIAJBDGpBqOPBAEHM5cEAEOkDAAs3ACAAKAIAKAIAIgApAwAgAEEIaikDACABKAIMIAJB6H1sakGYAmsiACkDACAAQQhqKAIAEN4DCzUAIAAoAgAoAgAiACkDACAAQQhqKQMAIAEoAgwgAkFsbGpBFGsiACgCACAAQQRqKAIAELoBCzEAIAFBGGwhAQNAIAEEQCAAKAIAIABBBGooAgAQhgggAUEYayEBIABBGGohAAwBCwsL2AEBAX8jAEEgayICJAAgAkEBOgAYIAIgATYCFCACIAA2AhAgAkGsnsAANgIMIAJBqJXCADYCCCMAQRBrIgAkACACQQhqIgEoAggiAkUEQEH3+MEAQStBrMrAABCRBQALIAAgASgCDDYCCCAAIAE2AgQgACACNgIAIwBBEGsiASQAIAFBCGogAEEIaigCADYCACABIAApAgA3AwAgASgCACIAQRRqKAIAIQICQAJAIABBDGooAgAOAgAAAQsgAg0AIAEoAgQtABAQgQUACyABKAIELQAQEIEFAAs3AQF/IwBBEGsiAyQAIAMgASACEKYFIABBCGogA0EIaigCADYCACAAIAMpAwA3AgAgA0EQaiQACzcBAX8jAEEQayIDJAAgAyABIAIQhQUgAEEIaiADQQhqKAIANgIAIAAgAykDADcCACADQRBqJAALOQEBfwJAIAEoAhgiAkEQcUUEQCACQSBxDQEgACABEMoIDwsgACgCACABENwDDwsgACgCACABEN0DCzIBAn8jAEEwayIDJAAgA0EIaiIEIAJBKBCSCRogASAAIARBKBCgAyEBIANBMGokACABCzEAIAFBDGwhAQNAIAEEQCAAKAIAIABBBGooAgAQhgggAUEMayEBIABBDGohAAwBCwsLNgEBfyMAQRBrIgIkACACIAEQMSACKAIAIQEgACACKwMIOQMIIAAgAUEAR603AwAgAkEQaiQACzIBAn8jAEFAaiIDJAAgA0EIaiIEIAJBOBCSCRogASAAIARBOBCgAyEBIANBQGskACABCzgAIAEoAgBFBEAgACABKAIEIAFBCGooAgAQmwQPCyAAIAEpAgQ3AgAgAEEIaiABQQxqKAIANgIACzgBAX8jAEEQayIDJAAgA0EIaiAAIAEQsQcgAygCCCADKAIMIAIQkAQoAgAQACEBIANBEGokACABCzYBAX8gACgCACgCACICKAIIIAAoAgQoAgwgAUHofWxqQZgCayIAKAIIRiACKQMAIAApAwBRcQs5ACABKAIERQRAIABBADYCBCAAIAI2AgAPCyAAIAEpAgA3AgAgAEEIaiABQQhqKAIANgIAIAIQiwgLOQEBfwJAIAEoAhgiAkEQcUUEQCACQSBxDQEgACABEP8GDwsgACgCACABENwDDwsgACgCACABEN0DCzAAIAACfyABLQAARQRAIAAgASkCBDcCBEEADAELIAAgAS0AARCICDoAAUEBCzoAAAsyACAAAn8gAS0AAEEERgRAIAAgASgCBDYCBEEADAELIAAgASkCABDGBjoAAUEBCzoAAAsxAQF/IwBBEGsiAiQAIAAEQCACQRBqJAAPC0Gw+8EAQSsgAkEIakHIk8AAIAEQ6QMACzwBAX8jAEEQayICJAAgAiAANgIMIAFBzPzAAEEFQdH8wABBAyACQQxqQdT8wAAQogMhACACQRBqJAAgAAs8AQF/IwBBEGsiAiQAIAIgADYCDCABQbT9wABBBkHR/MAAQQMgAkEMakHU/MAAEKIDIQAgAkEQaiQAIAALPAEBfyMAQRBrIgIkACACIAA2AgwgAUH4/cAAQQZB0fzAAEEDIAJBDGpB1PzAABCiAyEAIAJBEGokACAACzgAIAIgASkDCFQEQCAAIAEoAhA2AgggACABKQMAIAJCKH58NwMADwtBiIfBAEEXQaCHwQAQ6wYACzAAIAEtAAhBBEcEQCAAIAFBKBCSCRoPCyABLQAAIQEgAEEEOgAIIAAgARCICDoAAAswACABLQAgQQJHBEAgACABQSgQkgkaDwsgAS0AACEBIABBAjoAICAAIAEQ7gc6AAALQwEBfyACQYCU69wDRiEDA0ACQAJAAkAgACgCACgCCCICDgMCAQEAC0EDIQILIAIPCyADBEAQtAEMAQUQygUACwALAAs8AQF/IwBBEGsiAiQAIAIgADYCDCABQeK0wQBBBEHmtMEAQQYgAkEMakHstMEAEKIDIQAgAkEQaiQAIAALMQAgAS0AEEEJRwRAIAAgAUHAABCSCRoPCyABLQAAIQEgAEEJOgAQIAAgARCICDoAAAs8AQF/IwBBEGsiAiQAIAIgADYCDCABQZjAwQBBBUGdwMEAQQUgAkEMakGkwMEAEKIDIQAgAkEQaiQAIAALMAAgAAJ/IAEtAABFBEAgACABKAIENgIEQQAMAQsgACABLQABEPoHOgABQQELOgAACzYBAX8jAEEQayICJAAgAkEIaiABEJwFIAIoAgwhASAAIAIoAgg2AgAgACABNgIEIAJBEGokAAtDAQF/IAFBgJTr3ANGIQIDQAJAAkACQCAAKAIAKAIIIgEOAwIBAQALQQMhAQsgAQ8LIAIEQBC0AQwBBRDKBQALAAsACy8BAX8gASgCACIEQQFxBEAgACABIAQgBEF+cSACIAMQiQQPCyAAIAQgAiADENoFCz0BAX8gACgCACEBAkAgAEEEai0AAA0AQYydwgAoAgBB/////wdxRQ0AEJgJDQAgAUEBOgABCyABQQA6AAALNQEBf0EMEFAiA0UEQAALIAMgAToACCADQfjuwAA2AgQgAyACNgIAIAAgA61CIIZCA4Q3AgALMwACQCAAQfz///8HSw0AIABFBEBBBA8LIAAgAEH9////B0lBAnQQzwEiAEUNACAADwsACzQAIwBBEGsiASQAIAFBCGpBAUHk/MAAQRMQiwUgAEEBNgIAIAAgASkDCDcCBCABQRBqJAALLQACQCAAIAFNBEAgASACTQ0BIAEgAiADEM0IAAsgACABIAMQzggACyABIABrCzQAIwBBEGsiASQAIAFBCGpBAUG6/cAAQRQQiwUgAEEBNgIAIAAgASkDCDcCBCABQRBqJAALNAAjAEEQayIBJAAgAUEIakEBQf79wABBFBCLBSAAQQE2AgAgACABKQMINwIEIAFBEGokAAs4AQF/IwBBEGsiAiQAIAIgACgCADYCDCABQajgwABBByACQQxqQbDgwAAQigMhACACQRBqJAAgAAs0ACMAQRBrIgEkACABQQhqQSdB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AgAQVwsnAQF/IAEgAmogA6dBGXYiBDoAACACQQhrIABxIAFqQQhqIAQ6AAALKgACQCAAKAIABEAgACgCBEUNAQsgAEEIaigCACIAIAAoAgBBAWs2AgALCy0AIwBBEGsiASQAIAFBCGpBAUH3/MAAQRcQiwUgACABKQMINwIAIAFBEGokAAstACMAQRBrIgEkACABQQhqQQFBjv3AAEEUEIsFIAAgASkDCDcCACABQRBqJAALLQAjAEEQayIBJAAgAUEIakEBQc79wABBGRCLBSAAIAEpAwg3AgAgAUEQaiQACy0AIwBBEGsiASQAIAFBCGpBAUHO/cAAQRkQiwUgACABKQMINwIAIAFBEGokAAstACMAQRBrIgEkACABQQhqQQFBkv7AAEEZEIsFIAAgASkDCDcCACABQRBqJAALLQAjAEEQayIBJAAgAUEIakEBQZL+wABBGRCLBSAAIAEpAwg3AgAgAUEQaiQACy4BAX8jAEFAaiIDJAAgASAAIAMgAkHAABCSCSIBQcAAEKADIQIgAUFAayQAIAILVgEEfyMAQRBrIgIkACACQQhqIgMgAUEMaigCACABQQhqKAIAIgQgASgCACIFGzYCBCADIAQgASgCBCAFGzYCACAAIAIoAgggAigCDBCbBCACQRBqJAALMQEBfyAAKAIAIgIoAgAgAigCBCAAKAIEKAIMIAFBBXRrQSBrIgAoAgQgACgCCBCbBwsmACABQQN0IQEDQCABBEAgAUEIayEBIAAQiAIgAEEIaiEADAELCwswAQJ/IAIgASACIAMQjAQiBGotAAAhBSABIAIgBCADEMkGIAAgBToABCAAIAQ2AgALKAAgACgCACgCACIAKQMAIABBCGopAwAgASgCDCACQVRsakEsaxC2AQsoACAAKAIAKAIAIgApAwAgAEEIaikDACABKAIMIAJBUGxqQTBrELYBCzABAX8CQCAAKAIAIgFFDQAgASAAKAIEKAIAEQEAIAAoAgQoAgRFDQAgACgCABB+CwsrAAJ/IANFBEAgASACEM8BDAELIAEgAhC6BgshAiAAIAE2AgQgACACNgIACygAIAFB/wFxBH9BAQUgACgCAEH1n8AAQQEgAEEEaigCACgCDBEEAAsLKwEBfyMAQRBrIgIkACACQgI3AwAgAkIANwMIIAAgASACEPwBIAJBEGokAAsyAAJAIAFB/wFxDQBBjJ3CACgCAEH/////B3FFDQAQmAkNACAAQQE6AAELIABBADoAAAssACABQdjmwQAQzwcaQQgQUCIARQRAAAsgACACNgIEIABBADYCACAAEKgIAAsqAQF/IAAgAhCkByAAKAIIIgMgACgCBGogASACEJIJGiAAIAIgA2o2AggLKAEBfwJAIABBf0YNACAAIAAoAgQiAUEBazYCBCABQQFHDQAgABB+Cws6AQJ/QcCcwgAtAAAhAUHAnMIAQQA6AABBxJzCACgCACECQcScwgBBADYCACAAIAI2AgQgACABNgIACzABAX9BGBDXByIBQoGAgIAQNwIAIAEgACkCADcCCCABQRBqIABBCGopAgA3AgAgAQsqAQF/IAAgAhD0AiAAKAIIIgMgACgCBGogASACEJIJGiAAIAIgA2o2AggLKAAgARCmByAAQQhqIAE2AgAgACABQQhqNgIEIAAgAS0ABEEARzYCAAsoAQF/IwBBMGsiBCQAIAAgASACIAQgA0EwEJIJIgAQ9AEgAEEwaiQACyQAIAIgAEEBayIATQRAIAAgAkHc2MEAEP8DAAsgASAAQRRsagsoAQF/IAAoAgAiAQRAIAEgAEEMaigCACAAKAIQIABBFGooAgAQ6AULCygAIAEoAgBFBEAgAUF/NgIAIAAgATYCBCAAIAFBBGo2AgAPCxD4CAALKAAgASgCAEUEQCABQX82AgAgACABNgIEIAAgAUEIajYCAA8LEPgIAAsoAQF/IAAoAgAiASABKAIAIgFBAWs2AgAgAUEBRgRAIAAoAgAQvQMLCygBAX8gACgCACIBIAEoAgAiAUEBazYCACABQQFGBEAgACgCABDfBgsLSwEBfyMAQRBrIgMkACADIAI2AgggAyABNgIEIAMgADYCACMAQRBrIgAkACAAQQhqIANBCGooAgA2AgAgACADKQIANwMAQQEQgQUACyEAIAAoAgAiAEEBcQRAIABBfnEgASACEJoHDwsgABDVBQsoAQF/IAAoAgAiASABKAIAIgFBAWs2AgAgAUEBRgRAIAAoAgAQlQULCyEAIAEEfyACEIsIQQAFQQELIQEgACACNgIEIAAgATYCAAsoAQF/IAAoAgAiASABKAIAIgFBAWs2AgAgAUEBRgRAIAAoAgAQ8QMLCyYBAX8jAEEQayIBJAAgASAAELEGNgIM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Qf////8HcQR/EJgJBUEBCwsbAQF/IABBBGooAgAiAQRAIAAoAgAgARCGCAsLHQAgACkDAFAEQEH3+MEAQStBpK7BABCRBQALIAALLAAgAEEBOgAUIABBgICACDYCECAAQqCGgICAywA3AgggAELQgICAkAM3AgALGgAgASACKAIAEQEAIAIoAgQEQCABEH4LQQALGwAgAC0AAEUEQCAAQQRqEIQIIABBDGoQhAgLCxoBAX8gACgCACEBIABBfzYCACABRQRADwsACxsBAX8gARAbIQIgACABNgIEIAAgAkEBRzYCAAsbACAAKAIAIAAoAgQgASgCACABQQRqKAIAEHQLGgAgABCzB0EBczoAASAAIAEtAABBAEc6AAALGAAgACABNgIEIABBAyABIAFBA08bNgIACxgAIAAoAgBBCGogASACIAMgBBBkQf8BcQsVAEEBQQIgABA6IgBBAUYbQQAgABsLHAAgAEEIaiAAKAIAIAAoAgQgACgCDCgCCBEDAAsaACAAKAIAIABBBGooAgAQhgggAEEMahC1BguGAwIFfwJ+IAEgACgCBEsEQCMAQdAAayIDJAAgAyACNgIIIABBCGooAgAhAiADIANBCGo2AgwCQAJAIAIgASACaiIBTQRAIAAoAgAiBCAEQQFqIgVBA3ZBB2wgBEEISRsiBEEBdiABSQRAIANBKGogAkEsIAEgBEEBaiICIAEgAksbEPsCIAMoAjQiAkUNAiADIAMpAzg3AyAgAyACNgIcIAMgAykCLDcCFCADIAMoAigiBjYCEEFUIQRBACEBA0AgASAFRgRAIAApAgAhCCAAIAMpAxA3AgAgA0EYaiIBKQMAIQkgASAAQQhqIgApAgA3AwAgACAJNwIAIAMgCDcDECADQRBqEOYGDAULIAAoAgwiByABaiwAAEEATgRAIAMgBiACIANBDGogACABENYGENUGIAIgAygCAEF/c0EsbGogBCAHakEsEJIJGgsgAUEBaiEBIARBLGshBAwACwALIAAgA0EMakH2AEEsEKABDAILEMgFAAsgAygCLBoLIANB0ABqJAALCxYAIAEgAEEEaigCACAAQQhqKAIAEFcLEwAgAEUgAUEjTXJFBEAgARAcCwsVACABQf8BcUECRwRAIAAgARDMBAsLGQAgASACIAMQ4gYgAEEEOgAAIAAgAzYCBAsSACAAIAEQzwEiAARAIAAPCwALFgEBf0GAAkHAABDPASIABEAgAA8LAAsZAAJAIAFB/wFxDQAQswcNACAAQQE6AAALCxgAIAAgASAAIAEgAhCMBCIAIAIQyQYgAAsZAQF/IAEQOyECIAAgATYCBCAAIAJFNgIACxQAIAEEQCAAIAEQhggPCyAAEIsICxEAIAAEQCABIABBGGwQpAgLCxEAIAAEQCABIABBDGwQpAgLCxcAIABFBEBB9/jBAEErIAEQkQUACyAACxMAIACtIAFBCGogAhC4BkH/AXELEwAgAK0gAUEIaiACELcGQf8BcQsYAQF/IAEQUCECIAAgATYCBCAAIAI2AgALEQAgAARAIAEgAEECdBCkCAsLEQAgAAR/IAAgARDPAQUgAQsLEwAgACgCACIAQSRPBEAgABAcCwsZACAAKAIAIgAoAgAgASAAKAIEKAIQEQIACw8AIAAQUCIABEAgAA8LAAsRAQF/QQQQUCIABEAgAA8LAAsRAQF/QQwQUCIABEAgAA8LAAsRACAABEAgASAAQQF0EKQICwsRACAABEAgASAAQQN0EKQICwsRACAABEAgASAAQShsEKQICwsSACAABEAgACABQThBCBDoBQsLEgAgAARAIAEgAEGQAmwQpAgLCxEAIAAEQCABIABBMGwQpAgLCxIAIAAoAggEQCAAQQhqEPgGCwsZACAAp0UEQEH3+MEAQStBqL/BABCRBQALCxkAIAAoAgAiACgCACABIAAoAgQoAgwRAgALEQAgAARAIAEgAEE4bBCkCAsLEQAgAARAIAEgAEEUbBCkCAsLEQAgAARAIAEgAEEFdBCkCAsLFQAgACgCAEEIaiABIAIQjAFB/wFxCxUAIAAoAgBBCGogASACEIIBQf8BcQsVACAAKAIAQQhqIAEgAhCsAUH/AXELGQEBf0EIENcHIgEgADYCBCABQQA2AgAgAQsZACAAIAI2AgggACABKAIAKAIAKQMANwMACxoAIABFBEBB9/jBAEErQezYwQAQkQUACyAACxIAIAAoAgAEQCAAQQRqEPoFCwsWACAAp0UEQEH3+MEAQSsgARCRBQALCw4AIADAQcKXwgBqLQAACxkAIAEoAgBB3J3AAEEOIAEoAgQoAgwRBAALGQAgASgCAEHYtsAAQQUgASgCBCgCDBEEAAsZACABKAIAQcy9wABBCyABKAIEKAIMEQQACxkAIAEoAgBBzMnAAEEIIAEoAgQoAgwRBAALFQAgASAAKAIAIgAoAgQgACgCCBBXCxkAIAEoAgBB4OjAAEEVIAEoAgQoAgwRBAALEgAgAC0AAEEERwRAIAAQ7AULC18BBX8gAEGolcIANgIEIABBqJXCADYCACAAKAIMIgEEQCAAKAIIIgQgACgCECICKAIIIgNHBEAgAigCBCIFIANqIAQgBWogARCUCRogACgCDCEBCyACIAEgA2o2AggLCxkAIAEoAgBBrIbBAEEcIAEoAgQoAgwRBAALFAAgACgCBCIAIAAoAgBBAWs2AgALOwEBfyAAQQFqIQICQCABQf8BcQ0AQYydwgAoAgBB/////wdxRQ0AEJgJDQAgAkEBOgAACyAAQQA6AAALDgAgAMBBrJfCAGotAAALEgAgACgCAEEDRwRAIAAQyQELCxEAIAAoAgBBA0cEQCAAEHALCxIAIAAoAgBBA0cEQCAAEIcCCwsTACAAIAAoAhAiAEEBajYCECAACxMAIABBAWogARDJByAAQQA6AAALEgAgAEEEahC9CCAAQRxqEL0ICxMAIAAgASgCAEEIaiACIAMQiAELEwAgACABKAIAQQhqIAIgAxC9AgsSACAAKAIABEAgACgCBBCLCAsLEQAgACgCBARAIAAoAgAQfgsLFgAgACACNgIIIAAgASgCACkDADcDAAsOACAABEAgASAAEKQICwuyAQEBfyAAQQRqIAEQyQcjAEEgayIBJAAgACgCACECIABBADYCACABIAI2AgQCQCACQX9GBEAgAUEgaiQADAELIAFBADYCECMAQSBrIgAkACAAQci2wQA2AgQgACABQQRqNgIAIABBGGogAUEIaiIBQRBqKQIANwMAIABBEGogAUEIaikCADcDACAAIAEpAgA3AwggAEGk1MAAIABBBGpBpNTAACAAQQhqQbS3wQAQ0gEACwsRAEGV+vAAIABB/wFxQQN0dgsUACAAKAIAIAEgACgCBCgCDBECAAvMCAEDfyMAQfAAayIFJAAgBSADNgIMIAUgAjYCCAJAAkACQAJAIAUCfwJAAkAgAUGBAk8EQANAIAAgBmohByAGQQFrIQYgB0GAAmosAABBv39MDQALIAZBgQJqIgcgAUkNAiABQYECayAGRw0EIAUgBzYCFAwBCyAFIAE2AhQLIAUg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jMEANgIEIAAgATYCAAsTACAAQdiMwQA2AgQgACABNgIACxMAIABByIzBADYCBCAAIAE2AgALEAAgACgCCCABIAIQ4gZBAAsPACAAEJYEIABBDGoQlgQLEQAgACgCABCACCAAKAIAEH4LDwAgACABKAIAQQhqEJ8FCxMAIABB1MnBADYCBCAAIAE2AgALEwAgAEHkycEANgIEIAAgATYCAAsVACAAQZDzwQBBAkGE88EAQQEQ1AULFQAgAEGV88EAQQNBhPPBAEEBENQFCxUAIABBhPPBAEEBQYTzwQBBARDUBQsLACAABEAgABB+CwsTACAAQSg2AgQgAEGA/cEANgIACwsAIAEEQCAAEH4LCw4AIAEQuQcgACABEIQFC3cBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRRqQQI2AgAgA0EcakECNgIAIANBLGpBATYCACADQayjwAA2AhAgA0EANgIIIANBATYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQgQYACw4AIAA1AgBBASABEO0BCw4AIAAxAABBASABEO0BCw4AIAAoAgAaA0AMAAsAC3cBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRRqQQI2AgAgA0EcakECNgIAIANBLGpBATYCACADQcyjwAA2AhAgA0EANgIIIANBATYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQgQYAC3cBAX8jAEEwayIDJAAgAyABNgIEIAMgADYCACADQRRqQQI2AgAgA0EcakECNgIAIANBLGpBATYCACADQYCkwAA2AhAgA0EANgIIIANBATYCJCADIANBIGo2AhggAyADQQRqNgIoIAMgAzYCICADQQhqIAIQgQYAC2wBAX8jAEEQayIDJAAgAyABNgIMIAMgADYCCCMAQSBrIgAkACAAQQxqQQE2AgAgAEEUakEBNgIAIABByOHAADYCCCAAQQA2AgAgAEEDNgIcIAAgA0EIajYCGCAAIABBGGo2AhAgACACEIEGAAsOACAAKAIAIAEgAhCUAQsPACAAKAIALQAAIAEQnAcLCwAgACABEClBAEcLDQAgACABIAIgAxDUBAsSAEG1+MEAQQ9BvPzAABCRBQALEgBBtfjBAEEPQaT9wAAQkQUACxIAQbX4wQBBD0Ho/cAAEJEFAAsNACAAIAEgAiADEMYHCw4AIAAoAgAgASACEIIECw8AIAAoAgAgACgCDBDaBwsPACAAKAIAIAAoAgwQ3AcLDQAgACAAIAAgABDQBgsNACAAIAAgACAAEM4GCw0AIAAgASACIAMQnwMLDQAgACAAIAAgABDLBgsNACAAIAEgAiADENsECw4AIAAoAgAgACAAEKMFCw4AIAAoAgAgASACELwICw0AIAAgASACIAMQvQILDQADQCAALQAMRQ0ACwsPACAAKAIAKAIAIAEQ9QELDQADQCAALQAYRQ0ACwsOACABEKQEIAAgARCOBQsPACAAKAIAIAAoAgwQ3wcLDQAgACABIAIgAxCbBwsOACAAKAIAIAEgAhCZBQsNACAAIAEgAiADEOEECwsAIAAjAGokACMACwsAIABBASABEO0BCw0AIAFB3L3BAEECEFcLCQAgABALQQFGCwkAIAAQFEEARwsKACAAIAEgAhAaCwwAIAAoAgAgARCoAwsJACAAEB1BAEcLCQAgABAeQQBHCwkAIAAQIEEARwsJACAAIAEQJQALDAAgACgCACABEMoICw0AQcTUwABBGxD1CAALDgBB39TAAEHPABD1CAALDAAgACgCACABEMgGCwoAIAAQugMaQQELCQAgABAuQQBHCwsAIAAgASADEIMDCwwAIAAoAgAgARDwBQsLACAAIAIgAxCkAwsLACAAIAIgAxClAwsLACAAIAAgABCkBgsLACAAIAAgABCiBgsLACAAIAAgABClBgsJACAAIAIQ3ggLCwAgACAAIAAQowULDAAgACgCACABEIQJCwwAIAAoAgAgARDyBQsKACAAQRBqEPkBCwwAIAAgASkCADcDAAsMACAAIAEpAgg3AwALDAAgAC0AACABEJwHCwkAIAAQEkEBRgsMACAAKAIAIAEQlgILCwAgACABIAIQ5wILCwAgACABIAIQuwELCwAgACABIAMQ5gILCwAgACAAIAAQpwYLrwEBA38gASEFAkAgAkEPTQRAIAAhAQwBCyAAQQAgAGtBA3EiA2ohBCADBEAgACEBA0AgASAFOgAAIAFBAWoiASAESQ0ACwsgBCACIANrIgJBfHEiA2ohASADQQBKBEAgBUH/AXFBgYKECGwhAwNAIAQgAzYCACAEQQRqIgQgAUkNAAsLIAJBA3EhAgsgAgRAIAEgAmohAgNAIAEgBToAACABQQFqIgEgAkkNAAsLIAALswIBB38CQCACIgRBD00EQCAAIQIMAQsgAEEAIABrQQNxIgNqIQUgAwRAIAAhAiABIQYDQCACIAYtAAA6AAAgBkEBaiEGIAJBAWoiAiAFSQ0ACwsgBSAEIANrIghBfHEiB2ohAgJAIAEgA2oiA0EDcSIEBEAgB0EATA0BIANBfHEiBkEEaiEBQQAgBEEDdCIJa0EYcSEEIAYoAgAhBgNAIAUgBiAJdiABKAIAIgYgBHRyNgIAIAFBBGohASAFQQRqIgUgAkkNAAsMAQsgB0EATA0AIAMhAQNAIAUgASgCADYCACABQQRqIQEgBUEEaiIFIAJJDQALCyAIQQNxIQQgAyAHaiEBCyAEBEAgAiAEaiEDA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0kNAAsLIAALQwEDfwJAIAJFDQADQCAALQAAIgMgAS0AACIERgRAIABBAWohACABQQFqIQEgAkEBayICDQEMAgsLIAMgBGshBQsgBQuWBQEIfwJAAkACfwJAIAIiBCAAIAFrSwRAIAEgBGohBiAAIARqIQIgBEEPSw0BIAAMAgsgBEEPTQRAIAAhAgwDCyAAQQAgAGtBA3EiBmohBSAGBEAgACECIAEhAwNAIAIgAy0AADoAACADQQFqIQMgAkEBaiICIAVJDQALCyAFIAQgBmsiBEF8cSIHaiECAkAgASAGaiIGQQNxIgMEQCAHQQBMDQEgBkF8cSIIQQRqIQFBACADQQN0IglrQRhxIQogCCgCACEDA0AgBSADIAl2IAEoAgAiAyAKdHI2AgAgAUEEaiEBIAVBBGoiBSACSQ0ACwwBCyAHQQBMDQAgBiEBA0AgBSABKAIANgIAIAFBBGohASAFQQRqIgUgAkkNAAsLIARBA3EhBCAGIAdqIQEMAgsgAkF8cSEDQQAgAkEDcSIHayEIIAcEQCABIARqQQFrIQUDQCACQQFrIgIgBS0AADoAACAFQQFrIQUgAiADSw0ACwsgAyAEIAdrIgdBfHEiBGshAkEAIARrIQQCQCAGIAhqIgZBA3EiBQRAIARBAE4NASAGQXxxIghBBGshAUEAIAVBA3QiCWtBGHEhCiAIKAIAIQUDQCADQQRrIgMgBSAKdCABKAIAIgUgCXZyNgIAIAFBBGshASACIANJDQALDAELIARBAE4NACABIAdqQQRrIQEDQCADQQRrIgMgASgCADYCACABQQRrIQEgAiADSQ0ACwsgB0EDcSIBRQ0CIAQgBmohBiACIAFrCyEDIAZBAWshAQNAIAJBAWsiAiABLQAAOgAAIAFBAWshASACIANLDQALDAELIARFDQAgAiAEaiEDA0AgAiABLQAAOgAAIAFBAWohASACQQFqIgIgA0kNAAsLIAALCQAgACABEIcICwcAIABBfnELCgAgACgCABDVBQsLAEG8nMIAKAIARQsJACAAIAEQ3gULDwBBuJjCABDKBCgCABAACwkAIABBADYCAAsKACAAQYEoOwAACwkAIABBBDoAAAsJACAAQQE7AQALCQAgAEECNgIACw8AQciYwgAQygQoAgAQAAt5AQF+An9B6JzCACkDACIBQgBSBEBBAEHwnMIAIAFQGwwBC0H4nMIAAn4CQCAARQ0AIAApAwAhASAAQgA3AwAgAUIBUg0AIAApAwghASAAKQMQDAELQgEhAUICCzcDAEHwnMIAIAE3AwBB6JzCAEIBNwMAQfCcwgALC1sBAX8Cf0GAncIALQAAIgEEQEGBncIAQQAgARsMAQtBgZ3CACAABH8gAC0AACEBIABBADoAACAALQABQQAgAUEBcWtxBUEACzoAAEGAncIAQQE6AABBgZ3CAAsLBwAgABD1BwsEACAACw0AQvzOo+XczZib5gALDQBCxZ/g9bqY1vDaAAsMAEKxzs2E6fba1SkLBABBEgsEAEEUCwQAQRQLBABBFAsEAEEUCwQAQRQLDQBCzLGl3dTr+vGifwsNAELhutTy5Jfqlah/CwwAQsDE7qfmhabrDgsEAEEACwwAQqmMr6S11eWPVgsEAEIACwQAQRkLDQBCxuXsxvut5rKnfwvMAQEDfwJ/IwBBEGsiASQAAkACQAJ/QeCcwgAoAgAiAARAQeScwgBBACAAGwwBCxAoIQBB4JzCACgCACECQeCcwgBBATYCACACQeScwgAoAgAhAkHknMIAIAA2AgAgAhDEB0HknMIACyIABEAgASAAKAIAQSEQugUgASgCAA0BIAEoAgQiABAnQQFHDQIgAUEQaiQAIAAMAwtB+KrBAEHGACABQQhqQcjVwABBoKzBABDpAwALQdjVwABBJBD1CAALQfzVwABBPBD1CAALCw0A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MjMvanMtc3lzLTAuMy42MC9zcmMvbGliLnJzcmV0dXJuIHRoaXNQHxAAWQAAAMMWAAABAAAAeAAAAAQAAAAEAAAAkwAAAHgAAAAAAAAAAQAAAJIAAABjbG9zdXJlIGludm9rZWQgcmVjdXJzaXZlbHkgb3IgZGVzdHJveWVkIGFscmVhZHl4AAAABAAAAAQAAACTAAAAAQAAAC9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL3JlZ2lzdHJ5L3NyYy9naXRodWIuY29tLTFlY2M2Mjk5ZGI5ZWM4MjMvb25jZV9jZWxsLTEuMTYuMC9zcmMvaW1wX3N0ZC5ycyggEABgAAAApQAAAAkAAAAoIBAAYAAAAKsAAAA2AAAAfgAAAAAAAAABAAAAlAAAAH4AAAAEAAAABAAAAJUAAAB+AAAABAAAAAQAAACWAAAAQWNjZXNzRXJyb3JsaWJyYXJ5L3N0ZC9zcmMvdGhyZWFkL21vZC5yc2ZhaWxlZCB0byBnZW5lcmF0ZSB1bmlxdWUgdGhyZWFkIElEOiBiaXRzcGFjZSBleGhhdXN0ZWQAACEQADcAAADjIBAAHQAAAFUEAAANAAAAdW5jYXRlZ29yaXplZCBlcnJvcm90aGVyIGVycm9yb3V0IG9mIG1lbW9yeXVuZXhwZWN0ZWQgZW5kIG9mIGZpbGV1bnN1cHBvcnRlZGFyZ3VtZW50IGxpc3QgdG9vIGxvbmdpbnZhbGlkIGZpbGVuYW1ldG9vIG1hbnkgbGlua3Njcm9zcy1kZXZpY2UgbGluayBvciByZW5hbWVkZWFkbG9ja2V4ZWN1dGFibGUgZmlsZSBidXN5cmVzb3VyY2UgYnVzeWZpbGUgdG9vIGxhcmdlZmlsZXN5c3RlbSBxdW90YSBleGNlZWRlZHNlZWsgb24gdW5zZWVrYWJsZSBmaWxlbm8gc3RvcmFnZSBzcGFjZXdyaXRlIHplcm90aW1lZCBvdXRpbnZhbGlkIGRhdGFpbnZhbGlkIGlucHV0IHBhcmFtZXRlcnN0YWxlIG5ldHdvcmsgZmlsZSBoYW5kbGVmaWxlc3lzdGVtIGxvb3Agb3IgaW5kaXJlY3Rpb24gbGltaXQgKGUuZy4gc3ltbGluayBsb29wKXJlYWQtb25seSBmaWxlc3lzdGVtIG9yIHN0b3JhZ2UgbWVkaXVtaXMgYSBkaXJlY3Rvcnlub3QgYSBkaXJlY3RvcnlvcGVyYXRpb24gd291bGQgYmxvY2tlbnRpdHkgYWxyZWFkeSBleGlzdHNicm9rZW4gcGlwZW5ldHdvcmsgZG93bmFkZHJlc3Mgbm90IGF2YWlsYWJsZWFkZHJlc3MgaW4gdXNlbm90IGNvbm5lY3RlZG5ldHdvcmsgdW5yZWFjaGFibGVob3N0IHVucmVhY2hhYmxlIChvcyBlcnJvciAAqIoQAAAAAADAIxAACwAAAJ+HEAABAAAAW2xpYnJhcnkvc3RkL3NyYy9wYXRoLnJz5SMQABcAAADYAgAAGAAAAOUjEAAXAAAA/QIAACMAAADlIxAAFwAAAP8CAAAdAAAA5SMQABcAAAALAwAAHgAAAOUjEAAXAAAAFwMAAB4AAADlIxAAFwAAAJ0DAAAiAAAA5SMQABcAAACPAwAAJgAAAOUjEAAXAAAAlwMAACYAAADlIxAAFwAAAIEDAAAgAAAA5SMQABcAAACCAwAAIgAAAOUjEAAXAAAAswMAACIAAADlIxAAFwAAAL4DAAAmAAAA5SMQABcAAADFAwAAJgAAADxsb2NrZWQ+bGlicmFyeS9zdGQvc3JjL3N5c19jb21tb24vdGhyZWFkX2luZm8ucnMAAADUJBAAKQAAABYAAAAzAAAAbGlicmFyeS9zdGQvc3JjL3Bhbmlja2luZy5ycxAlEAAcAAAAPgIAAA8AAABvcGVyYXRpb24gc3VjY2Vzc2Z1bHRpbWUgbm90IGltcGxlbWVudGVkIG9uIHRoaXMgcGxhdGZvcm0AAABQJRAAJQAAAGxpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC90aW1lLnJzAIAlEAAvAAAADQAAAAkAAACAJRAALwAAAB8AAAAJAAAAb3BlcmF0aW9uIG5vdCBzdXBwb3J0ZWQgb24gdGhpcyBwbGF0Zm9ybdAlEAAoAAAAJAAAAGNvbmR2YXIgd2FpdCBub3Qgc3VwcG9ydGVkAAAEJhAAGgAAAGxpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC9sb2Nrcy9jb25kdmFyLnJzKCYQADgAAAAUAAAACQAAAGxpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC9sb2Nrcy9tdXRleC5ycwAAcCYQADYAAAAUAAAACQAAAGNhbid0IHNsZWVwALgmEAALAAAAbGlicmFyeS9zdGQvc3JjL3N5cy93YXNtLy4uL3Vuc3VwcG9ydGVkL3RocmVhZC5ycwAAAMwmEAAxAAAAGgAAAAkAAAACAAAAlwAAAAgAAAAEAAAAmAAAAGxpYnJhcnkvc3RkL3NyYy9zeXNfY29tbW9uL3RocmVhZF9wYXJrZXIvZ2VuZXJpYy5ycwAkJxAAMwAAACcAAAAVAAAAaW5jb25zaXN0ZW50IHBhcmsgc3RhdGUAaCcQABcAAAAkJxAAMwAAADUAAAAXAAAAcGFyayBzdGF0ZSBjaGFuZ2VkIHVuZXhwZWN0ZWRseQCYJxAAHwAAACQnEAAzAAAAMgAAABEAAABpbmNvbnNpc3RlbnQgc3RhdGUgaW4gdW5wYXJr0CcQABwAAAAkJxAAMwAAAGwAAAASAAAAJCcQADMAAAB6AAAADgAAAA4AAAAQAAAAFgAAABUAAAALAAAAFgAAAA0AAAALAAAAEwAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABEAAAASAAAAEAAAABAAAAATAAAAEgAAAA0AAAAOAAAAFQAAAAwAAAALAAAAFQAAABUAAAAPAAAADgAAABMAAAAmAAAAOAAAABkAAAAXAAAADAAAAAkAAAAKAAAAEAAAABcAAAAZAAAADgAAAA0AAAAUAAAACAAAABsAAADCIRAAsiEQAJwhEAAcOxAAkSEQAHshEABuIRAAYyEQAFAhEACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EACsOhAArDoQAKw6EAB0OhAAVDsQADw7EACwIxAAnSMQAHA7EACQIxAAgiMQAG0jEABhIxAAViMQAEEjEAAsIxAAHSMQAA8jEADwORAA6SIQALEiEACYIhAAgSIQAHUiEABsIhAAYiIQAFIiEAA7IhAAIiIQABQiEAAHIhAA8yEQAOshEADQIRAAYWxyZWFkeSBib3Jyb3dlZHgAAAAEAAAABAAAAJkAAAB4AAAABAAAAAQAAACaAAAAbnVsbCBwb2ludGVyIHBhc3NlZCB0byBydXN0cmVjdXJzaXZlIHVzZSBvZiBhbiBvYmplY3QgZGV0ZWN0ZWQgd2hpY2ggd291bGQgbGVhZCB0byB1bnNhZmUgYWxpYXNpbmcgaW4gcnVzdEpzVmFsdWUoAACuKhAACAAAAJ+HEAABAAAAeAAAAAAAAAABAAAAkgAAAFVuYWJsZSB0byBjYWxsIHRoZSBTeW1ib2woKSBmdW5jdGlvblVuYWJsZSB0byBjb252ZXJ0IHRoZSByZXR1cm4gdmFsdWUgb2YgU3ltYm9sKCkgaW50byBhIHN5bWJvbFJlc291cmNleAAAAAQAAAAEAAAAIAAAAFdhc214AAAABAAAAAQAAACbAAAASW5zdWZmaWNpZW50IHJlc291cmNlczogZCsQABgAAABUeXBlTWlzbWF0Y2h4AAAABAAAAAQAAACcAAAAVW5zdXBwb3J0ZWRJbnZhbGlkV2ViQXNzZW1ibHkAAAB4AAAABAAAAAQAAACTAAAAIGRvZXNuJ3QgbWF0Y2gganMgdmFsdWUgdHlwZSAAAACoihAAAAAAANArEAAdAAAAVW5zdXBwb3J0ZWQgZmVhdHVyZTogAAAAACwQABUAAABJbnZhbGlkIGlucHV0IFdlYkFzc2VtYmx5IGNvZGUgYXQgb2Zmc2V0IAAAACAsEAApAAAAqG0QAAIAAABJbXBvcnQAAHgAAAAEAAAABAAAAJ0AAABFcnJvciB3aGlsZSBpbXBvcnRpbmcgAAB0LBAAFgAAAB5lEAABAAAAqG0QAAIAAABOb3RJbkV4cG9ydHNEaWZmZXJlbnRTdG9yZXNDcHVGZWF0dXJlU3RhcnQAAHgAAAAEAAAABAAAAJ4AAABMaW5reAAAAAQAAAAEAAAAnwAAAENhbid0IGdldCAgZnJvbSB0aGUgaW5zdGFuY2UgZXhwb3J0c/QsEAAKAAAA/iwQABoAAABjYW5ub3QgbWl4IGltcG9ydHMgZnJvbSBkaWZmZXJlbnQgc3RvcmVzKC0QACgAAABtaXNzaW5nIHJlcXVpcmVkIENQVSBmZWF0dXJlczogAFgtEAAfAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vcmVnaXN0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dCBiZSBmb3VuZAAArDsQABoAAABhZGRyZXNzIGlzIGluIHVzZQAAANA7EAARAAAAaW8gZXJyb3LsOxAACAAAAGxvY2sgZXJyb3IAAPw7EAAKAAAAZmlsZSBleGlzdHMAEDwQAAsAAABpbnZhbGlkIGZkAAAkPBAACgAAAGZkIG5vdCBhIGZpbGUAAAA4PBAADQAAAGZkIG5vdCBhIGRpcmVjdG9yeQAAUDwQABIAAABVbmtub3duRXJyb3JEaXJlY3RvcnlOb3RFbXB0eVdyaXRlWmVyb1dvdWxkQmxvY2tVbmV4cGVjdGVkRW9mVGltZWRPdXRQZXJtaXNzaW9uRGVuaWVkTm9EZXZpY2VFbnRpdHlOb3RGb3VuZE5vdENvbm5lY3RlZEludmFsaWRJbnB1dEludmFsaWREYXRhSW50ZXJydXB0ZWRDb25uZWN0aW9uUmVzZXRDb25uZWN0aW9uUmVmdXNlZENvbm5lY3Rpb25BYm9ydGVkQnJva2VuUGlwZUFkZHJlc3NOb3RBdmFpbGFibGVBZGRyZXNzSW5Vc2VJT0Vycm9yTG9ja0FscmVhZHlFeGlzdHNJbnZhbGlkRmROb3RBRmlsZUJhc2VOb3REaXJlY3RvcnkrPxAASwAAACABAAAbAAAAKz8QAEsAAAAoAQAAEQAAACs/EABLAAAAJgEAABYAAAArPxAASwAAAPIAAAANAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi92ZnMvc3JjL21lbV9mcy9zdGRpby5ycwAAANg9EABhAAAAtQAAAAEAAABTdGRpbmJ1ZngAAAAEAAAABAAAAMAAAABjYW5ub3Qgc2VlayBgU3RkaW5gY2Fubm90IHdyaXRlIHRvIGBTdGRpbmBjYW5ub3QgZmx1c2ggYFN0ZGluYAAA2D0QAGEAAAC5AAAAAQAAAFN0ZG91dGNhbm5vdCBzZWVrIGBTdGRvdXRgY2Fubm90IHJlYWQgZnJvbSBgU3Rkb3V0YADYPRAAYQAAAL0AAAABAAAAU3RkZXJyY2Fubm90IHNlZWsgYFN0ZGVycmBjYW5ub3QgcmVhZCBmcm9tIGBTdGRlcnJgL3J1c3RjLzI1ODViY2VhMGJjMmE5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AAAAAAEAAABmAQAAoAAAAAQAAAAEAAAAoQAAAHgAAAAEAAAABAAAAGcBAABIYxAAZAAAAC8AAAAOAAAAYnl0ZUxlbmd0aC9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL2dpdC9jaGVja291dHMvd2FzbWVyLWYxMWYzMGU2MjczOWFhMjkvZWNkZTJhYS9saWIvYXBpL3NyYy9qcy9leHRlcm5hbHMvbWVtb3J5X3ZpZXcucnMAKl8QAG0AAAAlAAAADgAAACpfEABtAAAAJwAAAA4AAAB4AAAABAAAAAQAAABoAQAAZmlsZXR5cGVzcmMvZnMucnNhY2Nlc3NlZGNyZWF0ZWRtb2RpZmllZGZpbGVzeW1saW5rcGF0aG1ldGFkYXRhANBfEAAJAAAANgAAADgAAABNZW1GU2lubmVyAAB4AAAABAAAAAQAAABpAQAARXJyb3Igd2hlbiByZWFkaW5nIHRoZSBkaXI6IDRgEAAcAAAA6XAQAAEAAABFcnJvciB3aGVuIGNyZWF0aW5nIHRoZSBkaXI6IAAAAGBgEAAdAAAA6XAQAAEAAABFcnJvciB3aGVuIHJlbW92aW5nIHRoZSBkaXI6IAAAAJBgEAAdAAAA6XAQAAEAAABFcnJvciB3aGVuIHJlbW92aW5nIHRoZSBmaWxlOiAAAMBgEAAeAAAA6XAQAAEAAABFcnJvciB3aGVuIHJlbmFtaW5nOiAAAADwYBAAFQAAAOlwEAABAAAAcmVhZHdyaXRlYXBwZW5kdHJ1bmNhdGVjcmVhdGVjcmVhdGVfbmV3RXJyb3Igd2hlbiBvcGVuaW5nIHRoZSBmaWxlOiA/YRAAHQAAAOlwEAABAAAARXJyb3Igd2hlbiBzZXR0aW5nIHRoZSBmaWxlIGxlbmd0aDogbGEQACQAAADpcBAAAQAAAEVycm9yIHdoZW4gcmVhZGluZzogoGEQABQAAADpcBAAAQAAAENvdWxkIG5vdCBjb252ZXJ0IHRoZSBieXRlcyB0byBhIFN0cmluZzogAAAAxGEQACkAAADpcBAAAQAAAEVycm9yIHdoZW4gd3JpdGluZzogAGIQABQAAADpcBAAAQAAAEVycm9yIHdoZW4gd3JpdGluZyBzdHJpbmc6IAAkYhAAGwAAAOlwEAABAAAARXJyb3Igd2hlbiBmbHVzaGluZzogAAAA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bWJseS5JbnN0YW5jZWAgbWFudWFsbHkACGUQAAsAAAD4AAAADgAAAF9zdGFydEVycm9yIHdoaWxlIHJ1bm5pbmcgc3RhcnQgZnVuY3Rpb246IAAAnmkQACQAAABVbmV4cGVjdGVkIFdBU0kgZXJyb3Igd2hpbGUgcnVubmluZyBzdGFydCBmdW5jdGlvbjogzGkQADQAAABUaGUgX3N0YXJ0IGZ1bmN0aW9uIGlzIG5vdCBwcmVzZW50Q291bGQgbm90IGdldCB0aGUgc3Rkb3V0IGJ5dGVzOiAAACpqEAAgAAAA6XAQAAEAAABDb3VsZCBub3QgY29udmVydCB0aGUgc3Rkb3V0IGJ5dGVzIHRvIGEgU3RyaW5nOiBcahAAMAAAAOlwEAABAAAAQ291bGQgbm90IGdldCB0aGUgc3RkZXJyIGJ5dGVzOiCcahAAIAAAAOlwEAABAAAAQ291bGQgbm90IGNvbnZlcnQgdGhlIHN0ZGVyciBieXRlcyB0byBhIFN0cmluZzogzGoQADAAAADpcBAAAQAAAEVycm9yIHdyaXRpbmcgc3RkaW46IAAAAAxrEAAVAAAA6XAQAAEAAACgAQAACAAAAAQAAAChAQAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi9hcGkvc3JjL2pzL3RyYXAucnNEaxAAXAAAAM4AAABbAAAAb2JqZWN0IHVzZWQgd2l0aCB0aGUgd3JvbmcgY29udGV4dAAAsGsQACIAAAAvaG9tZS9jb25zdWx0aW5nLy5jYXJnby9naXQvY2hlY2tvdXRzL3dhc21lci1mMTFmMzBlNjI3MzlhYTI5L2VjZGUyYWEvbGliL2FwaS9zcmMvanMvc3RvcmUucnMAAADcaxAAXQAAAFYBAAANAAAA3GsQAF0AAABcAQAADQAAANxrEABdAAAAoQEAAA4AAADcaxAAXQAAAJcBAAA5AAAA3GsQAF0AAACmAQAAEgAAAAAAAAD//////////y9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL2dpdC9jaGVja291dHMvd2FzbWVyLWYxMWYzMGU2MjczOWFhMjkvZWNkZTJhYS9saWIvd2FzaS9zcmMvc3RhdGUvcGlwZS5yc5hsEABgAAAAOgAAACUAAACYbBAAYAAAAE0AAAAhAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi93YXNpL3NyYy9zeXNjYWxscy9tb2QucnMAABhtEABiAAAAQQUAACYAAAAYbRAAYgAAAEIFAAA2AAAALwAAAJxtEAABAAAAOiAAAKiKEAAAAAAAqG0QAAIAAAA0dxAASQAAAFMBAAAYAAAAc3RyZWFtIGRpZCBub3QgY29udGFpbiB2YWxpZCBVVEYtOAAAzG0QACIAAAAVAAAANHcQAEkAAADHAQAAHAAAAGZhaWxlZCB0byBmaWxsIHdob2xlIGJ1ZmZlcgAMbhAAGwAAACUAAAA0dxAASQAAAIcBAAAbAAAANHcQAEkAAACWAQAAMAAAAC9ydXN0Yy8yNTg1YmNlYTBiYzJhOWM0MmE0YmUyYzFlYmE1YzYxMTM3ZjJiMTY3L2xpYnJhcnkvc3RkL3NyYy9pby9yZWFkYnVmLnJzAAAAVG4QAE0AAAD9AAAAFgAAAFRuEABNAAAA0wAAADUAAABUbhAATQAAAMsAAAA2AAAAY2Fubm90IHJlY3Vyc2l2ZWx5IGFjcXVpcmUgbXV0ZXjUbhAAIAAAAC9ydXN0Yy8yNTg1YmNlYTBiYzJhOWM0MmE0YmUyYzFlYmE1YzYxMTM3ZjJiMTY3L2xpYnJhcnkvc3RkL3NyYy9zeXMvd2FzbS8uLi91bnN1cHBvcnRlZC9sb2Nrcy9tdXRleC5ycwAA/G4QAGYAAAAUAAAACQAAAAovcnVzdGMvMjU4NWJjZWEwYmMyYTljNDJhNGJlMmMxZWJhNWM2MTEzN2YyYjE2Ny9saWJyYXJ5L3N0ZC9zcmMvc3luYy9tcG1jL21vZC5ycwAAAHVvEABQAAAAhQAAAC0AAAB4AAAABAAAAAQAAACiAQAAowEAAKQBAAClAQAACAAAAAQAAAB7AAAApQEAAAgAAAAEAAAAewAAAHwAAAAIAAAABAAAAHsAAAB4AAAABAAAAAQAAACmAQAAY2Fubm90IGFkdmFuY2UgcGFzdCBgcmVtYWluaW5nYDogIDw9IAAAADBwEAAhAAAAUXAQAAQAAAAvaG9tZS9jb25zdWx0aW5nLy5jYXJnby9yZWdpc3RyeS9zcmMvZ2l0aHViLmNvbS0xZWNjNjI5OWRiOWVjODIzL2J5dGVzLTEuMy4wL3NyYy9ieXRlcy5ycwAAAGhwEABZAAAAJQIAAAkAAABGYWlsZWQgdG8gZ2V0IGVudHJ5OiBgAADUcBAAFQAAAOlwEAABAAAAQWxsIGFyZ3VtZW50cyBtdXN0IGJlIHN0cmluZ3NBbGwgZW52aXJvbm1lbnQga2V5cyBtdXN0IGJlIHN0cmluZ3NBbGwgZW52aXJvbm1lbnQgdmFsdWVzIG11c3QgYmUgc3RyaW5nc0FsbCBwcmVvcGVuIGtleXMgbXVzdCBiZSBzdHJpbmdzQWxsIHByZW9wZW4gdmFsdWVzIG11c3QgYmUgc3RyaW5ncwAAAKAAAAAEAAAABAAAAKEAAABub3QgaW1wbGVtZW50ZWQ6IAAAALhxEAARAAAAVGhlIHR5cGUgYGAgaXMgbm90IHlldCBzdXBwb3J0ZWQgaW4gdGhlIEpTIEZ1bmN0aW9uIEFQSQDUcRAACgAAAN5xEAAtAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi9hcGkvc3JjL2pzL3R5cGVzLnJzAAAAHHIQAF0AAAAgAAAADgAAABxyEABdAAAAHwAAADQAAAAcchAAXQAAAB4AAAA0AAAAHHIQAF0AAAAdAAAANAAAABxyEABdAAAAHAAAADQAAADschAAagAAAB8BAAAqAAAA7HIQAGoAAACnAQAANwAAAC9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL2dpdC9jaGVja291dHMvd2FzbWVyLWYxMWYzMGU2MjczOWFhMjkvZWNkZTJhYS9saWIvYXBpL3NyYy9qcy9leHRlcm5hbHMvZnVuY3Rpb24ucnMAAOxyEABqAAAAzQQAAAUAAAB4AAAACAAAAAQAAAA6AAAAeAAAAAgAAAAEAAAApwEAADoAAABocxAAuAAAAKgBAAB1AQAAuAAAALsAAADschAAagAAAMwEAAAFAAAA7HIQAGoAAADOBAAABQAAAOxyEABqAAAAzwQAAAUAAADschAAagAAANAEAAAFAAAA7HIQAGoAAADRBAAABQAAAOxyEABqAAAA0gQAAAUAAADschAAagAAANMEAAAFAAAA7HIQAGoAAADVBAAABQAAAAABX193YmdkX2Rvd25jYXN0X3Rva2VucHRyL3J1c3RjLzI1ODViY2VhMGJjMmE5YzQyYTRiZTJjMWViYTVjNjExMzdmMmIxNjcvbGlicmFyeS9zdGQvc3JjL3N5bmMvbXBtYy9saXN0LnJzAD50EABRAAAA7wAAADgAAAClAQAACAAAAAQAAAB7AAAAL3J1c3RjLzI1ODViY2VhMGJjMmE5YzQyYTRiZTJjMWViYTVjNjExMzdmMmIxNjcvbGlicmFyeS9zdGQvc3JjL3N5bmMvbXBtYy96ZXJvLnJzAAAAsHQQAFEAAAClAAAAGQAAALB0EABRAAAArAAAABEAAACwdBAAUQAAAMgAAAAVAAAAsHQQAFEAAADJAAAAKAAAALB0EABRAAAAwwAAABUAAACwdBAAUQAAAMQAAAAoAAAAsHQQAFEAAADBAAAAJgAAAKUBAAAIAAAABAAAAHsAAAAvcnVzdGMvMjU4NWJjZWEwYmMyYTljNDJhNGJlMmMxZWJhNWM2MTEzN2YyYjE2Ny9saWJyYXJ5L2NvcmUvc3JjL3NsaWNlL21vZC5ycwAAAIR1EABNAAAAxAIAACAAAACEdRAATQAAAMQCAAAtAAAAhHUQAE0AAADIAgAAIAAAAIR1EABNAAAAyAIAACsAAAAvcnVzdGMvMjU4NWJjZWEwYmMyYTljNDJhNGJlMmMxZWJhNWM2MTEzN2YyYjE2Ny9saWJyYXJ5L2FsbG9jL3NyYy9zbGljZS5ycwAAFHYQAEoAAAAhBAAAFQAAABR2EABKAAAALwQAAB4AAAAUdhAASgAAADgEAAAYAAAAFHYQAEoAAAA5BAAAGQAAABR2EABKAAAAPAQAABoAAAAUdhAASgAAAEIEAAANAAAAFHYQAEoAAABDBAAAEgAAAAAAAAEAQevtwQALkioBAQAAAAAAAAEBAABmYWlsZWQgdG8gZmlsbCBidWZmZXJmYWlsZWQgdG8gd3JpdGUgd2hvbGUgYnVmZmVyDHcQABwAAAAXAAAAL3J1c3RjLzI1ODViY2VhMGJjMmE5YzQyYTRiZTJjMWViYTVjNjExMzdmMmIxNjcvbGlicmFyeS9zdGQvc3JjL2lvL21vZC5ycwAAADR3EABJAAAADQYAACEAAAC8AAAADAAAAAQAAACpAQAAqgEAAKsBAABmb3JtYXR0ZXIgZXJyb3IAqHcQAA8AAAAoAAAANHcQAEkAAAAkBQAAFgAAADR3EABJAAAAKAUAAA0AAABhZHZhbmNpbmcgaW8gc2xpY2VzIGJleW9uZCB0aGVpciBsZW5ndGgA5HcQACcAAAA0dxAASQAAACYFAAANAAAAoAAAAAQAAAAEAAAAoQAAAEVycm9yIHdoaWxlIHNldHRpbmcgaW50byB0aGUganMgbmFtZXNwYWNlIG9iamVjdC9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL2dpdC9jaGVja291dHMvd2FzbWVyLWYxMWYzMGU2MjczOWFhMjkvZWNkZTJhYS9saWIvYXBpL3NyYy9qcy9pbXBvcnRzLnJzAGR4EABfAAAAsAAAABYAAABFcnJvciB3aGlsZSBzZXR0aW5nIGludG8gdGhlIGpzIGltcG9ydHMgb2JqZWN0AABkeBAAXwAAALMAAAASAAAAZHgQAF8AAADZAAAAPwAAAGR4EABfAAAA3QAAAEMAAABkeBAAXwAAAOAAAAA8AAAAZHgQAF8AAADvAAAAUAAAAGR4EABfAAAA9wAAABIAAABkeBAAXwAAAAABAAASAAAAZHgQAF8AAAACAQAAFgAAAABQb2lzb25FcnJvcgAAAAEBAAAAAAEAAAAAAAABAAAAAQEAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi93YXNpL3NyYy9saWIucnNhcmdzX2dldGFyZ3Nfc2l6ZXNfZ2V0Y2xvY2tfcmVzX2dldGNsb2NrX3RpbWVfZ2V0ZW52aXJvbl9nZXRlbnZpcm9uX3NpemVzX2dldGZkX2FkdmlzZWZkX2FsbG9jYXRlZmRfY2xvc2VmZF9kYXRhc3luY2ZkX2Zkc3RhdF9nZXRmZF9mZHN0YXRfc2V0X2ZsYWdzZmRfZmRzdGF0X3NldF9yaWdodHNmZF9maWxlc3RhdF9nZXRmZF9maWxlc3RhdF9zZXRfc2l6ZWZkX2ZpbGVzdGF0X3NldF90aW1lc2ZkX3ByZWFkZmRfcHJlc3RhdF9nZXRmZF9wcmVzdGF0X2Rpcl9uYW1lZmRfcHdyaXRlZmRfcmVhZGZkX3JlYWRkaXJmZF9yZW51bWJlcmZkX3NlZWtmZF9zeW5jZmRfdGVsbGZkX3dyaXRlcGF0aF9jcmVhdGVfZGlyZWN0b3J5cGF0aF9maWxlc3RhdF9nZXRwYXRoX2ZpbGVzdGF0X3NldF90aW1lc3BhdGhfbGlua3BhdGhfb3BlbnBhdGhfcmVhZGxpbmtwYXRoX3JlbW92ZV9kaXJlY3RvcnlwYXRoX3JlbmFtZXBhdGhfc3ltbGlua3BhdGhfdW5saW5rX2ZpbGVwb2xsX29uZW9mZnByb2NfZXhpdHByb2NfcmFpc2VyYW5kb21fZ2V0c2NoZWRfeWllbGRzb2NrX3JlY3Zzb2NrX3NlbmRzb2NrX3NodXRkb3dubm90IGltcGxlbWVudGVkp3kQAFkAAAC4AQAADgAAAHdhc2lfdW5zdGFibGV3YXNpX3NuYXBzaG90X3ByZXZpZXcxY2FsbGVkIGBPcHRpb246OnVud3JhcCgpYCBvbiBhIGBOb25lYCB2YWx1ZS9ydXN0Yy8yNTg1YmNlYTBiYzJhOWM0MmE0YmUyYzFlYmE1YzYxMTM3ZjJiMTY3L2xpYnJhcnkvc3RkL3NyYy9zeW5jL21wbWMvYXJyYXkucnOifBAAUgAAAGcBAAAZAAAAaW50ZXJuYWwgZXJyb3I6IGVudGVyZWQgdW5yZWFjaGFibGUgY29kZaJ8EABSAAAAZQEAACoAAAAvcnVzdGMvMjU4NWJjZWEwYmMyYTljNDJhNGJlMmMxZWJhNWM2MTEzN2YyYjE2Ny9saWJyYXJ5L3N0ZC9zcmMvc3luYy9tcG1jL3dha2VyLnJzAAA8fRAAUgAAAFgAAAAnAAAAPH0QAFIAAAA7AAAAKAAAAGNhbGxlZCBgUmVzdWx0Ojp1bndyYXAoKWAgb24gYW4gYEVycmAgdmFsdWUAfQAAAAgAAAAEAAAAewAAADx9EABSAAAAnQAAABkAAAA8fRAAUgAAAKgAAAAdAAAAPH0QAFIAAACUAAAAGQAAAC9ydXN0Yy8yNTg1YmNlYTBiYzJhOWM0MmE0YmUyYzFlYmE1YzYxMTM3ZjJiMTY3L2xpYnJhcnkvc3RkL3NyYy9zeW5jL21wbWMvY29udGV4dC5ycxx+EABUAAAAMQAAABUAAABkZXNjcmlwdGlvbigpIGlzIGRlcHJlY2F0ZWQ7IHVzZSBEaXNwbGF5bm90Y2FwYWJsZXhkZXZ0eHRic3l0aW1lZG91dHN0YWxlc3JjaHNwaXBlcm9mc3JhbmdlcHJvdG90eXBlcHJvdG9ub3N1cHBvcnRwcm90b3BpcGVwZXJtb3duZXJkZWFkb3ZlcmZsb3dueGlvbm90dHlub3RzdXBub3Rzb2Nrbm90cmVjb3ZlcmFibGVub3RlbXB0eW5vdGRpcm5vdGNvbm5ub3N5c25vc3Bjbm9wcm90b29wdG5vbXNnbm9tZW1ub2xpbmtub2xja25vZXhlY25vZW50bm9kZXZub2J1ZnNuZmlsZW5ldHVucmVhY2huZXRyZXNldG5ldGRvd25uYW1ldG9vbG9uZ211bHRpaG9wbXNnc2l6ZW1saW5rbWZpbGVsb29waXNkaXJpc2Nvbm5pb2ludmFsaW50cmlucHJvZ3Jlc3NpbHNlcWlkcm1ob3N0dW5yZWFjaGZiaWdmYXVsdGV4aXN0ZHF1b3Rkb21kZXN0YWRkcnJlcWRlYWRsa2Nvbm5yZXNldGNvbm5yZWZ1c2VkY29ubmFib3J0ZWRjaGlsZGNhbmNlbGVkYnVzeWJhZG1zZ2JhZGZhbHJlYWR5YWdhaW5hZm5vc3VwcG9ydGFkZHJub3RhdmFpbGFkZHJpbnVzZWFjY2Vzc3Rvb2JpZ3N1Y2Nlc3NFeHRlbnNpb246IENhcGFiaWxpdGllcyBpbnN1ZmZpY2llbnQuQ3Jvc3MtZGV2aWNlIGxpbmsuVGV4dCBmaWxlIGJ1c3kuQ29ubmVjdGlvbiB0aW1lZCBvdXQuUmVzZXJ2ZWQuTm8gc3VjaCBwcm9jZXNzLkludmFsaWQgc2Vlay5SZWFkLW9ubHkgZmlsZSBzeXN0ZW0uUmVzdWx0IHRvbyBsYXJnZS5Qcm90b2NvbCB3cm9uZyB0eXBlIGZvciBzb2NrZXQuUHJvdG9jb2wgbm90IHN1cHBvcnRlZC5Qcm90b2NvbCBlcnJvci5Ccm9rZW4gcGlwZS5PcGVyYXRpb24gbm90IHBlcm1pdHRlZC5QcmV2aW91cyBvd25lciBkaWVkLlZhbHVlIHRvbyBsYXJnZSB0byBiZSBzdG9yZWQgaW4gZGF0YSB0eXBlLk5vIHN1Y2ggZGV2aWNlIG9yIGFkZHJlc3MuSW5hcHByb3ByaWF0ZSBJL08gY29udHJvbCBvcGVyYXRpb24uTm90IHN1cHBvcnRlZCwgb3Igb3BlcmF0aW9uIG5vdCBzdXBwb3J0ZWQgb24gc29ja2V0Lk5vdCBhIHNvY2tldC5TdGF0ZSBub3QgcmVjb3ZlcmFibGUuRGlyZWN0b3J5IG5vdCBlbXB0eS5Ob3QgYSBkaXJlY3Rvcnkgb3IgYSBzeW1ib2xpYyBsaW5rIHRvIGEgZGlyZWN0b3J5LlRoZSBzb2NrZXQgaXMgbm90IGNvbm5lY3RlZC5GdW5jdGlvbiBub3Qgc3VwcG9ydGVkLk5vIHNwYWNlIGxlZnQgb24gZGV2aWNlLlByb3RvY29sIG5vdCBhdmFpbGFibGUuTm8gbWVzc2FnZSBvZiB0aGUgZGVzaXJlZCB0eXBlLk5vdCBlbm91Z2ggc3BhY2UuTm8gbG9ja3MgYXZhaWxhYmxlLkV4ZWN1dGFibGUgZmlsZSBmb3JtYXQgZXJyb3IuTm8gc3VjaCBmaWxlIG9yIGRpcmVjdG9yeS5ObyBzdWNoIGRldmljZS5ObyBidWZmZXIgc3BhY2UgYXZhaWxhYmxlLlRvbyBtYW55IGZpbGVzIG9wZW4gaW4gc3lzdGVtLk5ldHdvcmsgdW5yZWFjaGFibGUuQ29ubmVjdGlvbiBhYm9ydGVkIGJ5IG5ldHdvcmsuTmV0d29yayBpcyBkb3duLkZpbGVuYW1lIHRvbyBsb25nLk1lc3NhZ2UgdG9vIGxhcmdlLlRvbyBtYW55IGxpbmtzLkZpbGUgZGVzY3JpcHRvciB2YWx1ZSB0b28gbGFyZ2UuVG9vIG1hbnkgbGV2ZWxzIG9mIHN5bWJvbGljIGxpbmtzLklzIGEgZGlyZWN0b3J5LlNvY2tldCBpcyBjb25uZWN0ZWQuSS9PIGVycm9yLkludmFsaWQgYXJndW1lbnQuSW50ZXJydXB0ZWQgZnVuY3Rpb24uT3BlcmF0aW9uIGluIHByb2dyZXNzLklsbGVnYWwgYnl0ZSBzZXF1ZW5jZS5JZGVudGlmaWVyIHJlbW92ZWQuSG9zdCBpcyB1bnJlYWNoYWJsZS5GaWxlIHRvbyBsYXJnZS5CYWQgYWRkcmVzcy5GaWxlIGV4aXN0cy5NYXRoZW1hdGljcyBhcmd1bWVudCBvdXQgb2YgZG9tYWluIG9mIGZ1bmN0aW9uLkRlc3RpbmF0aW9uIGFkZHJlc3MgcmVxdWlyZWQuUmVzb3VyY2UgZGVhZGxvY2sgd291bGQgb2NjdXIuQ29ubmVjdGlvbiByZXNldC5Db25uZWN0aW9uIHJlZnVzZWQuQ29ubmVjdGlvbiBhYm9ydGVkLk5vIGNoaWxkIHByb2Nlc3Nlcy5PcGVyYXRpb24gY2FuY2VsZWQuRGV2aWNlIG9yIHJlc291cmNlIGJ1c3kuQmFkIG1lc3NhZ2UuQmFkIGZpbGUgZGVzY3JpcHRvci5Db25uZWN0aW9uIGFscmVhZHkgaW4gcHJvZ3Jlc3MuUmVzb3VyY2UgdW5hdmFpbGFibGUsIG9yIG9wZXJhdGlvbiB3b3VsZCBibG9jay5BZGRyZXNzIGZhbWlseSBub3Qgc3VwcG9ydGVkLkFkZHJlc3Mgbm90IGF2YWlsYWJsZS5BZGRyZXNzIGluIHVzZS5QZXJtaXNzaW9uIGRlbmllZC5Bcmd1bWVudCBsaXN0IHRvbyBsb25nLk5vIGVycm9yIG9jY3VycmVkLiBTeXN0ZW0gY2FsbCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5LkVycm5vY29kZQAAeAAAAAQAAAAEAAAArAEAAG5hbWV4AAAACAAAAAQAAACtAQAAbWVzc2FnZSAoZXJyb3IgKaiKEAAAAAAAl4cQAAgAAACfhxAAAQAAAGRhdGFkaXJub3QgeWV0IGltcGxlbWVudGVkOiC/hxAAFQAAAGNvdWxkIG5vdCBzZXJpYWxpemUgbnVtYmVyICB0byBlbnVtIFNuYXBzaG90MENsb2NraWTchxAAGwAAAPeHEAAZAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi93YXNpLXR5cGVzL3NyYy93YXNpL2V4dHJhLnJzAAAgiBAAZgAAAIoKAAASAAAAIHRvIGVudW0gQWR2aWNlANyHEAAbAAAAmIgQAA8AAAAgiBAAZgAAAIsLAAASAAAAIHRvIGVudW0gU25hcHNob3QwV2hlbmNl3IcQABsAAADIiBAAGAAAACCIEABmAAAA/QwAABIAAAAgdG8gZW51bSBXaGVuY2UA3IcQABsAAAAAiRAADwAAACCIEABmAAAAGQ0AABIAAAAgdG8gZW51bSBTaWduYWwA3IcQABsAAAAwiRAADwAAACCIEABmAAAATA8AABIAAABub3QgaW1wbGVtZW50ZWQgZm9yIG5vdwBgiRAAFwAAAC9ob21lL2NvbnN1bHRpbmcvLmNhcmdvL2dpdC9jaGVja291dHMvd2FzbWVyLWYxMWYzMGU2MjczOWFhMjkvZWNkZTJhYS9saWIvd2FzaS10eXBlcy9zcmMvd2FzaS9leHRyYV9tYW51YWwucnMAAACAiRAAbQAAAGkAAAAyAAAAgIkQAG0AAABoAAAAMwAAADB4AAAYAAAAL2hvbWUvY29uc3VsdGluZy8uY2FyZ28vZ2l0L2NoZWNrb3V0cy93YXNtZXItZjExZjMwZTYyNzM5YWEyOS9lY2RlMmFhL2xpYi93YXNpLXR5cGVzL3NyYy90eXBlcy5ycwAAABiKEABhAAAAcwAAAAkAAABjYXBhY2l0eSBvdmVyZmxvdwAAAIyKEAARAAAAL3J1c3RjLzI1ODViY2VhMGJjMmE5YzQyYTRiZTJjMWViYTVjNjExMzdmMmIxNjcvbGlicmFyeS9hbGxvYy9zcmMvdmVjL3NwZWNfZnJvbV9pdGVyX25lc3RlZC5ycwAAqIoQAF4AAAA7AAAAEgAAAC9ydXN0Yy8yNTg1YmNlYTBiYzJhOWM0MmE0YmUyYzFlYmE1YzYxMTM3ZjJiMTY3L2xpYnJhcnkvYWxsb2Mvc3JjL3ZlYy9tb2QucnMYixAATAAAAE0LAAANAAAAAAAAAAMAAAABAAAAAgAAABASCgsYGAkPBgcYCAMVGBgYGBgYDg0TFhgYGBgYGBgYGBgYDBgUGAUIFB0dAwRADQ4PGx0cNSs/SUEGMzodNhwIFB0dAwRADQ4PGx0cNSwrP0lBBjM3HQAAAAAAkwAgCAAAAADRACAIAAAAANEAIAgAAAAA/////38AQZiYwgALBf////9/AEGgmMIACwEDAEGwmMIACwEBAEHEmMIACwGnAEHUmMIACwGn"))];case 1:g=A.sent(),A.label=2;case 2:b=d(g),A.label=3;case 3:return [4,b];case 4:return A.sent(),[2]}}))}))};

/*
 *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
**************************************************************************** https://mths.be/punycode v1.4.1 by @mathias */
function ba(a,b,c,d){return new (c||(c=Promise))(function(e,f){function g(a){try{k(d.next(a));}catch(n){f(n);}}function h(a){try{k(d["throw"](a));}catch(n){f(n);}}function k(a){a.done?e(a.value):(new c(function(b){b(a.value);})).then(g,h);}k((d=d.apply(a,b||[])).next());})}
function ca(a,b){function c(a){return function(b){return d([a,b])}}function d(c){if(f)throw new TypeError("Generator is already executing.");for(;e;)try{if(f=1,g&&(h=c[0]&2?g["return"]:c[0]?g["throw"]||((h=g["return"])&&h.call(g),0):g.next)&&!(h=h.call(g,c[1])).done)return h;if(g=0,h)c=[c[0]&2,h.value];switch(c[0]){case 0:case 1:h=c;break;case 4:return e.label++,{value:c[1],done:!1};case 5:e.label++;g=c[1];c=[0];continue;case 7:c=e.ops.pop();e.trys.pop();continue;default:if(!(h=e.trys,h=0<h.length&&
h[h.length-1])&&(6===c[0]||2===c[0])){e=0;continue}if(3===c[0]&&(!h||c[1]>h[0]&&c[1]<h[3]))e.label=c[1];else if(6===c[0]&&e.label<h[1])e.label=h[1],h=c;else if(h&&e.label<h[2])e.label=h[2],e.ops.push(c);else {h[2]&&e.ops.pop();e.trys.pop();continue}}c=b.call(a,e);}catch(n){c=[6,n],g=0;}finally{f=h=0;}if(c[0]&5)throw c[1];return {value:c[0]?c[1]:void 0,done:!0}}var e={label:0,sent:function(){if(h[0]&1)throw h[1];return h[1]},trys:[],ops:[]},f,g,h,k;return k={next:c(0),"throw":c(1),"return":c(2)},"function"===
typeof Symbol&&(k[Symbol.iterator]=function(){return this}),k}function da(a){var b="function"===typeof Symbol&&a[Symbol.iterator],c=0;return b?b.call(a):{next:function(){a&&c>=a.length&&(a=void 0);return {value:a&&a[c++],done:!a}}}}
function ea(a,b){var c="function"===typeof Symbol&&a[Symbol.iterator];if(!c)return a;a=c.call(a);var d,e=[];try{for(;(void 0===b||0<b--)&&!(d=a.next()).done;)e.push(d.value);}catch(g){var f={error:g};}finally{try{d&&!d.done&&(c=a["return"])&&c.call(a);}finally{if(f)throw f.error;}}return e}function ia(){for(var a=[],b=0;b<arguments.length;b++)a=a.concat(ea(arguments[b]));return a}
var l="undefined"!==typeof globalThis?globalThis:"undefined"!==typeof window?window:"undefined"!==typeof global$1?global$1:"undefined"!==typeof self?self:{};function t(a){return a&&a.__esModule&&Object.prototype.hasOwnProperty.call(a,"default")?a["default"]:a}function u(a,b){return b={exports:{}},a(b,b.exports),b.exports}
var w=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});b.constants={O_RDONLY:0,O_WRONLY:1,O_RDWR:2,S_IFMT:61440,S_IFREG:32768,S_IFDIR:16384,S_IFCHR:8192,S_IFBLK:24576,S_IFIFO:4096,S_IFLNK:40960,S_IFSOCK:49152,O_CREAT:64,O_EXCL:128,O_NOCTTY:256,O_TRUNC:512,O_APPEND:1024,O_DIRECTORY:65536,O_NOATIME:262144,O_NOFOLLOW:131072,O_SYNC:1052672,O_DIRECT:16384,O_NONBLOCK:2048,S_IRWXU:448,S_IRUSR:256,S_IWUSR:128,S_IXUSR:64,S_IRWXG:56,S_IRGRP:32,S_IWGRP:16,S_IXGRP:8,S_IRWXO:7,S_IROTH:4,S_IWOTH:2,
S_IXOTH:1,F_OK:0,R_OK:4,W_OK:2,X_OK:1,UV_FS_SYMLINK_DIR:1,UV_FS_SYMLINK_JUNCTION:2,UV_FS_COPYFILE_EXCL:1,UV_FS_COPYFILE_FICLONE:2,UV_FS_COPYFILE_FICLONE_FORCE:4,COPYFILE_EXCL:1,COPYFILE_FICLONE:2,COPYFILE_FICLONE_FORCE:4};});t(w);
var ja=u(function(a,b){b.default="function"===typeof BigInt?BigInt:function(){throw Error("BigInt is not supported in this environment.");};}),ka=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});var c=w.constants.S_IFMT,d=w.constants.S_IFDIR,e=w.constants.S_IFREG,f=w.constants.S_IFBLK,g=w.constants.S_IFCHR,h=w.constants.S_IFLNK,k=w.constants.S_IFIFO,p=w.constants.S_IFSOCK;a=function(){function a(){}a.build=function(b,c){void 0===c&&(c=!1);var d=new a,e=b.gid,f=b.atime,g=b.mtime,h=b.ctime;
c=c?ja.default:function(a){return a};d.uid=c(b.uid);d.gid=c(e);d.rdev=c(0);d.blksize=c(4096);d.ino=c(b.ino);d.size=c(b.getSize());d.blocks=c(1);d.atime=f;d.mtime=g;d.ctime=h;d.birthtime=h;d.atimeMs=c(f.getTime());d.mtimeMs=c(g.getTime());e=c(h.getTime());d.ctimeMs=e;d.birthtimeMs=e;d.dev=c(0);d.mode=c(b.mode);d.nlink=c(b.nlink);return d};a.prototype._checkModeProperty=function(a){return (Number(this.mode)&c)===a};a.prototype.isDirectory=function(){return this._checkModeProperty(d)};a.prototype.isFile=
function(){return this._checkModeProperty(e)};a.prototype.isBlockDevice=function(){return this._checkModeProperty(f)};a.prototype.isCharacterDevice=function(){return this._checkModeProperty(g)};a.prototype.isSymbolicLink=function(){return this._checkModeProperty(h)};a.prototype.isFIFO=function(){return this._checkModeProperty(k)};a.prototype.isSocket=function(){return this._checkModeProperty(p)};return a}();b.Stats=a;b.default=a;});t(ka);
var la="undefined"!==typeof global$1?global$1:"undefined"!==typeof self?self:"undefined"!==typeof window?window:{},x=[],y=[],ma="undefined"!==typeof Uint8Array?Uint8Array:Array,oa=!1;function pa(){oa=!0;for(var a=0;64>a;++a)x[a]="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[a],y["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".charCodeAt(a)]=a;y[45]=62;y[95]=63;}
function qa(a,b,c){for(var d=[],e=b;e<c;e+=3)b=(a[e]<<16)+(a[e+1]<<8)+a[e+2],d.push(x[b>>18&63]+x[b>>12&63]+x[b>>6&63]+x[b&63]);return d.join("")}function ra(a){oa||pa();for(var b=a.length,c=b%3,d="",e=[],f=0,g=b-c;f<g;f+=16383)e.push(qa(a,f,f+16383>g?g:f+16383));1===c?(a=a[b-1],d+=x[a>>2],d+=x[a<<4&63],d+="=="):2===c&&(a=(a[b-2]<<8)+a[b-1],d+=x[a>>10],d+=x[a>>4&63],d+=x[a<<2&63],d+="=");e.push(d);return e.join("")}
function sa(a,b,c,d,e){var f=8*e-d-1;var g=(1<<f)-1,h=g>>1,k=-7;e=c?e-1:0;var p=c?-1:1,n=a[b+e];e+=p;c=n&(1<<-k)-1;n>>=-k;for(k+=f;0<k;c=256*c+a[b+e],e+=p,k-=8);f=c&(1<<-k)-1;c>>=-k;for(k+=d;0<k;f=256*f+a[b+e],e+=p,k-=8);if(0===c)c=1-h;else {if(c===g)return f?NaN:Infinity*(n?-1:1);f+=Math.pow(2,d);c-=h;}return (n?-1:1)*f*Math.pow(2,c-d)}
function ta(a,b,c,d,e,f){var g,h=8*f-e-1,k=(1<<h)-1,p=k>>1,n=23===e?Math.pow(2,-24)-Math.pow(2,-77):0;f=d?0:f-1;var q=d?1:-1,B=0>b||0===b&&0>1/b?1:0;b=Math.abs(b);isNaN(b)||Infinity===b?(b=isNaN(b)?1:0,d=k):(d=Math.floor(Math.log(b)/Math.LN2),1>b*(g=Math.pow(2,-d))&&(d--,g*=2),b=1<=d+p?b+n/g:b+n*Math.pow(2,1-p),2<=b*g&&(d++,g/=2),d+p>=k?(b=0,d=k):1<=d+p?(b=(b*g-1)*Math.pow(2,e),d+=p):(b=b*Math.pow(2,p-1)*Math.pow(2,e),d=0));for(;8<=e;a[c+f]=b&255,f+=q,b/=256,e-=8);d=d<<e|b;for(h+=e;0<h;a[c+f]=d&255,
f+=q,d/=256,h-=8);a[c+f-q]|=128*B;}var wa={}.toString,ya=Array.isArray||function(a){return "[object Array]"==wa.call(a)};z.TYPED_ARRAY_SUPPORT=void 0!==la.TYPED_ARRAY_SUPPORT?la.TYPED_ARRAY_SUPPORT:!0;var za=z.TYPED_ARRAY_SUPPORT?2147483647:1073741823;function Aa(a,b){if((z.TYPED_ARRAY_SUPPORT?2147483647:1073741823)<b)throw new RangeError("Invalid typed array length");z.TYPED_ARRAY_SUPPORT?(a=new Uint8Array(b),a.__proto__=z.prototype):(null===a&&(a=new z(b)),a.length=b);return a}
function z(a,b,c){if(!(z.TYPED_ARRAY_SUPPORT||this instanceof z))return new z(a,b,c);if("number"===typeof a){if("string"===typeof b)throw Error("If encoding is specified then the first argument must be a string");return Ba(this,a)}return Ca(this,a,b,c)}z.poolSize=8192;z._augment=function(a){a.__proto__=z.prototype;return a};
function Ca(a,b,c,d){if("number"===typeof b)throw new TypeError('"value" argument must not be a number');if("undefined"!==typeof ArrayBuffer&&b instanceof ArrayBuffer){b.byteLength;if(0>c||b.byteLength<c)throw new RangeError("'offset' is out of bounds");if(b.byteLength<c+(d||0))throw new RangeError("'length' is out of bounds");b=void 0===c&&void 0===d?new Uint8Array(b):void 0===d?new Uint8Array(b,c):new Uint8Array(b,c,d);z.TYPED_ARRAY_SUPPORT?(a=b,a.__proto__=z.prototype):a=Da(a,b);return a}if("string"===
typeof b){d=a;a=c;if("string"!==typeof a||""===a)a="utf8";if(!z.isEncoding(a))throw new TypeError('"encoding" must be a valid string encoding');c=Ea(b,a)|0;d=Aa(d,c);b=d.write(b,a);b!==c&&(d=d.slice(0,b));return d}return Fa(a,b)}z.from=function(a,b,c){return Ca(null,a,b,c)};z.TYPED_ARRAY_SUPPORT&&(z.prototype.__proto__=Uint8Array.prototype,z.__proto__=Uint8Array);
function Ga(a){if("number"!==typeof a)throw new TypeError('"size" argument must be a number');if(0>a)throw new RangeError('"size" argument must not be negative');}z.alloc=function(a,b,c){Ga(a);a=0>=a?Aa(null,a):void 0!==b?"string"===typeof c?Aa(null,a).fill(b,c):Aa(null,a).fill(b):Aa(null,a);return a};function Ba(a,b){Ga(b);a=Aa(a,0>b?0:Ma(b)|0);if(!z.TYPED_ARRAY_SUPPORT)for(var c=0;c<b;++c)a[c]=0;return a}z.allocUnsafe=function(a){return Ba(null,a)};z.allocUnsafeSlow=function(a){return Ba(null,a)};
function Da(a,b){var c=0>b.length?0:Ma(b.length)|0;a=Aa(a,c);for(var d=0;d<c;d+=1)a[d]=b[d]&255;return a}
function Fa(a,b){if(A(b)){var c=Ma(b.length)|0;a=Aa(a,c);if(0===a.length)return a;b.copy(a,0,0,c);return a}if(b){if("undefined"!==typeof ArrayBuffer&&b.buffer instanceof ArrayBuffer||"length"in b)return (c="number"!==typeof b.length)||(c=b.length,c=c!==c),c?Aa(a,0):Da(a,b);if("Buffer"===b.type&&ya(b.data))return Da(a,b.data)}throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");}
function Ma(a){if(a>=(z.TYPED_ARRAY_SUPPORT?2147483647:1073741823))throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x"+(z.TYPED_ARRAY_SUPPORT?2147483647:1073741823).toString(16)+" bytes");return a|0}z.isBuffer=Na;function A(a){return !(null==a||!a._isBuffer)}
z.compare=function(a,b){if(!A(a)||!A(b))throw new TypeError("Arguments must be Buffers");if(a===b)return 0;for(var c=a.length,d=b.length,e=0,f=Math.min(c,d);e<f;++e)if(a[e]!==b[e]){c=a[e];d=b[e];break}return c<d?-1:d<c?1:0};z.isEncoding=function(a){switch(String(a).toLowerCase()){case "hex":case "utf8":case "utf-8":case "ascii":case "latin1":case "binary":case "base64":case "ucs2":case "ucs-2":case "utf16le":case "utf-16le":return !0;default:return !1}};
z.concat=function(a,b){if(!ya(a))throw new TypeError('"list" argument must be an Array of Buffers');if(0===a.length)return z.alloc(0);var c;if(void 0===b)for(c=b=0;c<a.length;++c)b+=a[c].length;b=z.allocUnsafe(b);var d=0;for(c=0;c<a.length;++c){var e=a[c];if(!A(e))throw new TypeError('"list" argument must be an Array of Buffers');e.copy(b,d);d+=e.length;}return b};
function Ea(a,b){if(A(a))return a.length;if("undefined"!==typeof ArrayBuffer&&"function"===typeof ArrayBuffer.isView&&(ArrayBuffer.isView(a)||a instanceof ArrayBuffer))return a.byteLength;"string"!==typeof a&&(a=""+a);var c=a.length;if(0===c)return 0;for(var d=!1;;)switch(b){case "ascii":case "latin1":case "binary":return c;case "utf8":case "utf-8":case void 0:return Oa(a).length;case "ucs2":case "ucs-2":case "utf16le":case "utf-16le":return 2*c;case "hex":return c>>>1;case "base64":return Pa(a).length;
default:if(d)return Oa(a).length;b=(""+b).toLowerCase();d=!0;}}z.byteLength=Ea;
function Qa(a,b,c){var d=!1;if(void 0===b||0>b)b=0;if(b>this.length)return "";if(void 0===c||c>this.length)c=this.length;if(0>=c)return "";c>>>=0;b>>>=0;if(c<=b)return "";for(a||(a="utf8");;)switch(a){case "hex":a=b;b=c;c=this.length;if(!a||0>a)a=0;if(!b||0>b||b>c)b=c;d="";for(c=a;c<b;++c)a=d,d=this[c],d=16>d?"0"+d.toString(16):d.toString(16),d=a+d;return d;case "utf8":case "utf-8":return Ra(this,b,c);case "ascii":a="";for(c=Math.min(this.length,c);b<c;++b)a+=String.fromCharCode(this[b]&127);return a;
case "latin1":case "binary":a="";for(c=Math.min(this.length,c);b<c;++b)a+=String.fromCharCode(this[b]);return a;case "base64":return b=0===b&&c===this.length?ra(this):ra(this.slice(b,c)),b;case "ucs2":case "ucs-2":case "utf16le":case "utf-16le":b=this.slice(b,c);c="";for(a=0;a<b.length;a+=2)c+=String.fromCharCode(b[a]+256*b[a+1]);return c;default:if(d)throw new TypeError("Unknown encoding: "+a);a=(a+"").toLowerCase();d=!0;}}z.prototype._isBuffer=!0;function Sa(a,b,c){var d=a[b];a[b]=a[c];a[c]=d;}
z.prototype.swap16=function(){var a=this.length;if(0!==a%2)throw new RangeError("Buffer size must be a multiple of 16-bits");for(var b=0;b<a;b+=2)Sa(this,b,b+1);return this};z.prototype.swap32=function(){var a=this.length;if(0!==a%4)throw new RangeError("Buffer size must be a multiple of 32-bits");for(var b=0;b<a;b+=4)Sa(this,b,b+3),Sa(this,b+1,b+2);return this};
z.prototype.swap64=function(){var a=this.length;if(0!==a%8)throw new RangeError("Buffer size must be a multiple of 64-bits");for(var b=0;b<a;b+=8)Sa(this,b,b+7),Sa(this,b+1,b+6),Sa(this,b+2,b+5),Sa(this,b+3,b+4);return this};z.prototype.toString=function(){var a=this.length|0;return 0===a?"":0===arguments.length?Ra(this,0,a):Qa.apply(this,arguments)};z.prototype.equals=function(a){if(!A(a))throw new TypeError("Argument must be a Buffer");return this===a?!0:0===z.compare(this,a)};
z.prototype.inspect=function(){var a="";0<this.length&&(a=this.toString("hex",0,50).match(/.{2}/g).join(" "),50<this.length&&(a+=" ... "));return "<Buffer "+a+">"};
z.prototype.compare=function(a,b,c,d,e){if(!A(a))throw new TypeError("Argument must be a Buffer");void 0===b&&(b=0);void 0===c&&(c=a?a.length:0);void 0===d&&(d=0);void 0===e&&(e=this.length);if(0>b||c>a.length||0>d||e>this.length)throw new RangeError("out of range index");if(d>=e&&b>=c)return 0;if(d>=e)return -1;if(b>=c)return 1;b>>>=0;c>>>=0;d>>>=0;e>>>=0;if(this===a)return 0;var f=e-d,g=c-b,h=Math.min(f,g);d=this.slice(d,e);a=a.slice(b,c);for(b=0;b<h;++b)if(d[b]!==a[b]){f=d[b];g=a[b];break}return f<
g?-1:g<f?1:0};
function Ta(a,b,c,d,e){if(0===a.length)return -1;"string"===typeof c?(d=c,c=0):2147483647<c?c=2147483647:-2147483648>c&&(c=-2147483648);c=+c;isNaN(c)&&(c=e?0:a.length-1);0>c&&(c=a.length+c);if(c>=a.length){if(e)return -1;c=a.length-1;}else if(0>c)if(e)c=0;else return -1;"string"===typeof b&&(b=z.from(b,d));if(A(b))return 0===b.length?-1:Ua(a,b,c,d,e);if("number"===typeof b)return b&=255,z.TYPED_ARRAY_SUPPORT&&"function"===typeof Uint8Array.prototype.indexOf?e?Uint8Array.prototype.indexOf.call(a,b,c):
Uint8Array.prototype.lastIndexOf.call(a,b,c):Ua(a,[b],c,d,e);throw new TypeError("val must be string, number or Buffer");}
function Ua(a,b,c,d,e){function f(a,b){return 1===g?a[b]:a.readUInt16BE(b*g)}var g=1,h=a.length,k=b.length;if(void 0!==d&&(d=String(d).toLowerCase(),"ucs2"===d||"ucs-2"===d||"utf16le"===d||"utf-16le"===d)){if(2>a.length||2>b.length)return -1;g=2;h/=2;k/=2;c/=2;}if(e)for(d=-1;c<h;c++)if(f(a,c)===f(b,-1===d?0:c-d)){if(-1===d&&(d=c),c-d+1===k)return d*g}else -1!==d&&(c-=c-d),d=-1;else for(c+k>h&&(c=h-k);0<=c;c--){h=!0;for(d=0;d<k;d++)if(f(a,c+d)!==f(b,d)){h=!1;break}if(h)return c}return -1}
z.prototype.includes=function(a,b,c){return -1!==this.indexOf(a,b,c)};z.prototype.indexOf=function(a,b,c){return Ta(this,a,b,c,!0)};z.prototype.lastIndexOf=function(a,b,c){return Ta(this,a,b,c,!1)};
z.prototype.write=function(a,b,c,d){if(void 0===b)d="utf8",c=this.length,b=0;else if(void 0===c&&"string"===typeof b)d=b,c=this.length,b=0;else if(isFinite(b))b|=0,isFinite(c)?(c|=0,void 0===d&&(d="utf8")):(d=c,c=void 0);else throw Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");var e=this.length-b;if(void 0===c||c>e)c=e;if(0<a.length&&(0>c||0>b)||b>this.length)throw new RangeError("Attempt to write outside buffer bounds");d||(d="utf8");for(e=!1;;)switch(d){case "hex":a:{b=
Number(b)||0;d=this.length-b;c?(c=Number(c),c>d&&(c=d)):c=d;d=a.length;if(0!==d%2)throw new TypeError("Invalid hex string");c>d/2&&(c=d/2);for(d=0;d<c;++d){e=parseInt(a.substr(2*d,2),16);if(isNaN(e)){a=d;break a}this[b+d]=e;}a=d;}return a;case "utf8":case "utf-8":return Va(Oa(a,this.length-b),this,b,c);case "ascii":return Va(Wa(a),this,b,c);case "latin1":case "binary":return Va(Wa(a),this,b,c);case "base64":return Va(Pa(a),this,b,c);case "ucs2":case "ucs-2":case "utf16le":case "utf-16le":d=a;e=this.length-
b;for(var f=[],g=0;g<d.length&&!(0>(e-=2));++g){var h=d.charCodeAt(g);a=h>>8;h%=256;f.push(h);f.push(a);}return Va(f,this,b,c);default:if(e)throw new TypeError("Unknown encoding: "+d);d=(""+d).toLowerCase();e=!0;}};z.prototype.toJSON=function(){return {type:"Buffer",data:Array.prototype.slice.call(this._arr||this,0)}};
function Ra(a,b,c){c=Math.min(a.length,c);for(var d=[];b<c;){var e=a[b],f=null,g=239<e?4:223<e?3:191<e?2:1;if(b+g<=c)switch(g){case 1:128>e&&(f=e);break;case 2:var h=a[b+1];128===(h&192)&&(e=(e&31)<<6|h&63,127<e&&(f=e));break;case 3:h=a[b+1];var k=a[b+2];128===(h&192)&&128===(k&192)&&(e=(e&15)<<12|(h&63)<<6|k&63,2047<e&&(55296>e||57343<e)&&(f=e));break;case 4:h=a[b+1];k=a[b+2];var p=a[b+3];128===(h&192)&&128===(k&192)&&128===(p&192)&&(e=(e&15)<<18|(h&63)<<12|(k&63)<<6|p&63,65535<e&&1114112>e&&(f=
e));}null===f?(f=65533,g=1):65535<f&&(f-=65536,d.push(f>>>10&1023|55296),f=56320|f&1023);d.push(f);b+=g;}a=d.length;if(a<=ab)d=String.fromCharCode.apply(String,d);else {c="";for(b=0;b<a;)c+=String.fromCharCode.apply(String,d.slice(b,b+=ab));d=c;}return d}var ab=4096;
z.prototype.slice=function(a,b){var c=this.length;a=~~a;b=void 0===b?c:~~b;0>a?(a+=c,0>a&&(a=0)):a>c&&(a=c);0>b?(b+=c,0>b&&(b=0)):b>c&&(b=c);b<a&&(b=a);if(z.TYPED_ARRAY_SUPPORT)b=this.subarray(a,b),b.__proto__=z.prototype;else {c=b-a;b=new z(c,void 0);for(var d=0;d<c;++d)b[d]=this[d+a];}return b};function C(a,b,c){if(0!==a%1||0>a)throw new RangeError("offset is not uint");if(a+b>c)throw new RangeError("Trying to access beyond buffer length");}
z.prototype.readUIntLE=function(a,b,c){a|=0;b|=0;c||C(a,b,this.length);c=this[a];for(var d=1,e=0;++e<b&&(d*=256);)c+=this[a+e]*d;return c};z.prototype.readUIntBE=function(a,b,c){a|=0;b|=0;c||C(a,b,this.length);c=this[a+--b];for(var d=1;0<b&&(d*=256);)c+=this[a+--b]*d;return c};z.prototype.readUInt8=function(a,b){b||C(a,1,this.length);return this[a]};z.prototype.readUInt16LE=function(a,b){b||C(a,2,this.length);return this[a]|this[a+1]<<8};
z.prototype.readUInt16BE=function(a,b){b||C(a,2,this.length);return this[a]<<8|this[a+1]};z.prototype.readUInt32LE=function(a,b){b||C(a,4,this.length);return (this[a]|this[a+1]<<8|this[a+2]<<16)+16777216*this[a+3]};z.prototype.readUInt32BE=function(a,b){b||C(a,4,this.length);return 16777216*this[a]+(this[a+1]<<16|this[a+2]<<8|this[a+3])};z.prototype.readIntLE=function(a,b,c){a|=0;b|=0;c||C(a,b,this.length);c=this[a];for(var d=1,e=0;++e<b&&(d*=256);)c+=this[a+e]*d;c>=128*d&&(c-=Math.pow(2,8*b));return c};
z.prototype.readIntBE=function(a,b,c){a|=0;b|=0;c||C(a,b,this.length);c=b;for(var d=1,e=this[a+--c];0<c&&(d*=256);)e+=this[a+--c]*d;e>=128*d&&(e-=Math.pow(2,8*b));return e};z.prototype.readInt8=function(a,b){b||C(a,1,this.length);return this[a]&128?-1*(255-this[a]+1):this[a]};z.prototype.readInt16LE=function(a,b){b||C(a,2,this.length);a=this[a]|this[a+1]<<8;return a&32768?a|4294901760:a};
z.prototype.readInt16BE=function(a,b){b||C(a,2,this.length);a=this[a+1]|this[a]<<8;return a&32768?a|4294901760:a};z.prototype.readInt32LE=function(a,b){b||C(a,4,this.length);return this[a]|this[a+1]<<8|this[a+2]<<16|this[a+3]<<24};z.prototype.readInt32BE=function(a,b){b||C(a,4,this.length);return this[a]<<24|this[a+1]<<16|this[a+2]<<8|this[a+3]};z.prototype.readFloatLE=function(a,b){b||C(a,4,this.length);return sa(this,a,!0,23,4)};
z.prototype.readFloatBE=function(a,b){b||C(a,4,this.length);return sa(this,a,!1,23,4)};z.prototype.readDoubleLE=function(a,b){b||C(a,8,this.length);return sa(this,a,!0,52,8)};z.prototype.readDoubleBE=function(a,b){b||C(a,8,this.length);return sa(this,a,!1,52,8)};function E(a,b,c,d,e,f){if(!A(a))throw new TypeError('"buffer" argument must be a Buffer instance');if(b>e||b<f)throw new RangeError('"value" argument is out of bounds');if(c+d>a.length)throw new RangeError("Index out of range");}
z.prototype.writeUIntLE=function(a,b,c,d){a=+a;b|=0;c|=0;d||E(this,a,b,c,Math.pow(2,8*c)-1,0);d=1;var e=0;for(this[b]=a&255;++e<c&&(d*=256);)this[b+e]=a/d&255;return b+c};z.prototype.writeUIntBE=function(a,b,c,d){a=+a;b|=0;c|=0;d||E(this,a,b,c,Math.pow(2,8*c)-1,0);d=c-1;var e=1;for(this[b+d]=a&255;0<=--d&&(e*=256);)this[b+d]=a/e&255;return b+c};z.prototype.writeUInt8=function(a,b,c){a=+a;b|=0;c||E(this,a,b,1,255,0);z.TYPED_ARRAY_SUPPORT||(a=Math.floor(a));this[b]=a&255;return b+1};
function bb(a,b,c,d){0>b&&(b=65535+b+1);for(var e=0,f=Math.min(a.length-c,2);e<f;++e)a[c+e]=(b&255<<8*(d?e:1-e))>>>8*(d?e:1-e);}z.prototype.writeUInt16LE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,2,65535,0);z.TYPED_ARRAY_SUPPORT?(this[b]=a&255,this[b+1]=a>>>8):bb(this,a,b,!0);return b+2};z.prototype.writeUInt16BE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,2,65535,0);z.TYPED_ARRAY_SUPPORT?(this[b]=a>>>8,this[b+1]=a&255):bb(this,a,b,!1);return b+2};
function cb(a,b,c,d){0>b&&(b=4294967295+b+1);for(var e=0,f=Math.min(a.length-c,4);e<f;++e)a[c+e]=b>>>8*(d?e:3-e)&255;}z.prototype.writeUInt32LE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,4,4294967295,0);z.TYPED_ARRAY_SUPPORT?(this[b+3]=a>>>24,this[b+2]=a>>>16,this[b+1]=a>>>8,this[b]=a&255):cb(this,a,b,!0);return b+4};
z.prototype.writeUInt32BE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,4,4294967295,0);z.TYPED_ARRAY_SUPPORT?(this[b]=a>>>24,this[b+1]=a>>>16,this[b+2]=a>>>8,this[b+3]=a&255):cb(this,a,b,!1);return b+4};z.prototype.writeIntLE=function(a,b,c,d){a=+a;b|=0;d||(d=Math.pow(2,8*c-1),E(this,a,b,c,d-1,-d));d=0;var e=1,f=0;for(this[b]=a&255;++d<c&&(e*=256);)0>a&&0===f&&0!==this[b+d-1]&&(f=1),this[b+d]=(a/e>>0)-f&255;return b+c};
z.prototype.writeIntBE=function(a,b,c,d){a=+a;b|=0;d||(d=Math.pow(2,8*c-1),E(this,a,b,c,d-1,-d));d=c-1;var e=1,f=0;for(this[b+d]=a&255;0<=--d&&(e*=256);)0>a&&0===f&&0!==this[b+d+1]&&(f=1),this[b+d]=(a/e>>0)-f&255;return b+c};z.prototype.writeInt8=function(a,b,c){a=+a;b|=0;c||E(this,a,b,1,127,-128);z.TYPED_ARRAY_SUPPORT||(a=Math.floor(a));0>a&&(a=255+a+1);this[b]=a&255;return b+1};
z.prototype.writeInt16LE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,2,32767,-32768);z.TYPED_ARRAY_SUPPORT?(this[b]=a&255,this[b+1]=a>>>8):bb(this,a,b,!0);return b+2};z.prototype.writeInt16BE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,2,32767,-32768);z.TYPED_ARRAY_SUPPORT?(this[b]=a>>>8,this[b+1]=a&255):bb(this,a,b,!1);return b+2};
z.prototype.writeInt32LE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,4,2147483647,-2147483648);z.TYPED_ARRAY_SUPPORT?(this[b]=a&255,this[b+1]=a>>>8,this[b+2]=a>>>16,this[b+3]=a>>>24):cb(this,a,b,!0);return b+4};z.prototype.writeInt32BE=function(a,b,c){a=+a;b|=0;c||E(this,a,b,4,2147483647,-2147483648);0>a&&(a=4294967295+a+1);z.TYPED_ARRAY_SUPPORT?(this[b]=a>>>24,this[b+1]=a>>>16,this[b+2]=a>>>8,this[b+3]=a&255):cb(this,a,b,!1);return b+4};
function db(a,b,c,d){if(c+d>a.length)throw new RangeError("Index out of range");if(0>c)throw new RangeError("Index out of range");}z.prototype.writeFloatLE=function(a,b,c){c||db(this,a,b,4);ta(this,a,b,!0,23,4);return b+4};z.prototype.writeFloatBE=function(a,b,c){c||db(this,a,b,4);ta(this,a,b,!1,23,4);return b+4};z.prototype.writeDoubleLE=function(a,b,c){c||db(this,a,b,8);ta(this,a,b,!0,52,8);return b+8};z.prototype.writeDoubleBE=function(a,b,c){c||db(this,a,b,8);ta(this,a,b,!1,52,8);return b+8};
z.prototype.copy=function(a,b,c,d){c||(c=0);d||0===d||(d=this.length);b>=a.length&&(b=a.length);b||(b=0);0<d&&d<c&&(d=c);if(d===c||0===a.length||0===this.length)return 0;if(0>b)throw new RangeError("targetStart out of bounds");if(0>c||c>=this.length)throw new RangeError("sourceStart out of bounds");if(0>d)throw new RangeError("sourceEnd out of bounds");d>this.length&&(d=this.length);a.length-b<d-c&&(d=a.length-b+c);var e=d-c;if(this===a&&c<b&&b<d)for(d=e-1;0<=d;--d)a[d+b]=this[d+c];else if(1E3>e||
!z.TYPED_ARRAY_SUPPORT)for(d=0;d<e;++d)a[d+b]=this[d+c];else Uint8Array.prototype.set.call(a,this.subarray(c,c+e),b);return e};
z.prototype.fill=function(a,b,c,d){if("string"===typeof a){"string"===typeof b?(d=b,b=0,c=this.length):"string"===typeof c&&(d=c,c=this.length);if(1===a.length){var e=a.charCodeAt(0);256>e&&(a=e);}if(void 0!==d&&"string"!==typeof d)throw new TypeError("encoding must be a string");if("string"===typeof d&&!z.isEncoding(d))throw new TypeError("Unknown encoding: "+d);}else "number"===typeof a&&(a&=255);if(0>b||this.length<b||this.length<c)throw new RangeError("Out of range index");if(c<=b)return this;b>>>=
0;c=void 0===c?this.length:c>>>0;a||(a=0);if("number"===typeof a)for(d=b;d<c;++d)this[d]=a;else for(a=A(a)?a:Oa((new z(a,d)).toString()),e=a.length,d=0;d<c-b;++d)this[d+b]=a[d%e];return this};var eb=/[^+\/0-9A-Za-z-_]/g;
function Oa(a,b){b=b||Infinity;for(var c,d=a.length,e=null,f=[],g=0;g<d;++g){c=a.charCodeAt(g);if(55295<c&&57344>c){if(!e){if(56319<c){-1<(b-=3)&&f.push(239,191,189);continue}else if(g+1===d){-1<(b-=3)&&f.push(239,191,189);continue}e=c;continue}if(56320>c){-1<(b-=3)&&f.push(239,191,189);e=c;continue}c=(e-55296<<10|c-56320)+65536;}else e&&-1<(b-=3)&&f.push(239,191,189);e=null;if(128>c){if(0>--b)break;f.push(c);}else if(2048>c){if(0>(b-=2))break;f.push(c>>6|192,c&63|128);}else if(65536>c){if(0>(b-=3))break;
f.push(c>>12|224,c>>6&63|128,c&63|128);}else if(1114112>c){if(0>(b-=4))break;f.push(c>>18|240,c>>12&63|128,c>>6&63|128,c&63|128);}else throw Error("Invalid code point");}return f}function Wa(a){for(var b=[],c=0;c<a.length;++c)b.push(a.charCodeAt(c)&255);return b}
function Pa(a){a=(a.trim?a.trim():a.replace(/^\s+|\s+$/g,"")).replace(eb,"");if(2>a.length)a="";else for(;0!==a.length%4;)a+="=";oa||pa();var b=a.length;if(0<b%4)throw Error("Invalid string. Length must be a multiple of 4");var c="="===a[b-2]?2:"="===a[b-1]?1:0;var d=new ma(3*b/4-c);var e=0<c?b-4:b;var f=0;for(b=0;b<e;b+=4){var g=y[a.charCodeAt(b)]<<18|y[a.charCodeAt(b+1)]<<12|y[a.charCodeAt(b+2)]<<6|y[a.charCodeAt(b+3)];d[f++]=g>>16&255;d[f++]=g>>8&255;d[f++]=g&255;}2===c?(g=y[a.charCodeAt(b)]<<2|
y[a.charCodeAt(b+1)]>>4,d[f++]=g&255):1===c&&(g=y[a.charCodeAt(b)]<<10|y[a.charCodeAt(b+1)]<<4|y[a.charCodeAt(b+2)]>>2,d[f++]=g>>8&255,d[f++]=g&255);return d}function Va(a,b,c,d){for(var e=0;e<d&&!(e+c>=b.length||e>=a.length);++e)b[e+c]=a[e];return e}function Na(a){return null!=a&&(!!a._isBuffer||fb(a)||"function"===typeof a.readFloatLE&&"function"===typeof a.slice&&fb(a.slice(0,0)))}function fb(a){return !!a.constructor&&"function"===typeof a.constructor.isBuffer&&a.constructor.isBuffer(a)}
var gb=Object.freeze({__proto__:null,INSPECT_MAX_BYTES:50,kMaxLength:za,Buffer:z,SlowBuffer:function(a){+a!=a&&(a=0);return z.alloc(+a)},isBuffer:Na}),F=u(function(a,b){function c(a){for(var b=[],c=1;c<arguments.length;c++)b[c-1]=arguments[c];return new (gb.Buffer.bind.apply(gb.Buffer,d([void 0,a],b)))}var d=l&&l.__spreadArrays||function(){for(var a=0,b=0,c=arguments.length;b<c;b++)a+=arguments[b].length;a=Array(a);var d=0;for(b=0;b<c;b++)for(var k=arguments[b],p=0,n=k.length;p<n;p++,d++)a[d]=k[p];
return a};Object.defineProperty(b,"__esModule",{value:!0});b.Buffer=gb.Buffer;b.bufferAllocUnsafe=gb.Buffer.allocUnsafe||c;b.bufferFrom=gb.Buffer.from||c;});t(F);function hb(){throw Error("setTimeout has not been defined");}function ib(){throw Error("clearTimeout has not been defined");}var jb=hb,kb=ib;"function"===typeof la.setTimeout&&(jb=setTimeout);"function"===typeof la.clearTimeout&&(kb=clearTimeout);
function pb(a){if(jb===setTimeout)return setTimeout(a,0);if((jb===hb||!jb)&&setTimeout)return jb=setTimeout,setTimeout(a,0);try{return jb(a,0)}catch(b){try{return jb.call(null,a,0)}catch(c){return jb.call(this,a,0)}}}function rb(a){if(kb===clearTimeout)return clearTimeout(a);if((kb===ib||!kb)&&clearTimeout)return kb=clearTimeout,clearTimeout(a);try{return kb(a)}catch(b){try{return kb.call(null,a)}catch(c){return kb.call(this,a)}}}var sb=[],tb=!1,ub,vb=-1;
function wb(){tb&&ub&&(tb=!1,ub.length?sb=ub.concat(sb):vb=-1,sb.length&&xb());}function xb(){if(!tb){var a=pb(wb);tb=!0;for(var b=sb.length;b;){ub=sb;for(sb=[];++vb<b;)ub&&ub[vb].run();vb=-1;b=sb.length;}ub=null;tb=!1;rb(a);}}function G(a){var b=Array(arguments.length-1);if(1<arguments.length)for(var c=1;c<arguments.length;c++)b[c-1]=arguments[c];sb.push(new yb(a,b));1!==sb.length||tb||pb(xb);}function yb(a,b){this.fun=a;this.array=b;}yb.prototype.run=function(){this.fun.apply(null,this.array);};
function zb(){}
var performance=la.performance||{},Ab=performance.now||performance.mozNow||performance.msNow||performance.oNow||performance.webkitNow||function(){return (new Date).getTime()},Bb=new Date,Cb={nextTick:G,title:"browser",browser:!0,env:{},argv:[],version:"",versions:{},on:zb,addListener:zb,once:zb,off:zb,removeListener:zb,removeAllListeners:zb,emit:zb,binding:function(){throw Error("process.binding is not supported");},cwd:function(){return "/"},chdir:function(){throw Error("process.chdir is not supported");},
umask:function(){return 0},hrtime:function(a){var b=.001*Ab.call(performance),c=Math.floor(b);b=Math.floor(b%1*1E9);a&&(c-=a[0],b-=a[1],0>b&&(c--,b+=1E9));return [c,b]},platform:"browser",release:{},config:{},uptime:function(){return (new Date-Bb)/1E3}},Db="function"===typeof Object.create?function(a,b){a.super_=b;a.prototype=Object.create(b.prototype,{constructor:{value:a,enumerable:!1,writable:!0,configurable:!0}});}:function(a,b){function c(){}a.super_=b;c.prototype=b.prototype;a.prototype=new c;
a.prototype.constructor=a;},Eb=/%[sdj%]/g;function Fb(a){if(!Gb(a)){for(var b=[],c=0;c<arguments.length;c++)b.push(H(arguments[c]));return b.join(" ")}c=1;var d=arguments,e=d.length;b=String(a).replace(Eb,function(a){if("%%"===a)return "%";if(c>=e)return a;switch(a){case "%s":return String(d[c++]);case "%d":return Number(d[c++]);case "%j":try{return JSON.stringify(d[c++])}catch(h){return "[Circular]"}default:return a}});for(var f=d[c];c<e;f=d[++c])b=null!==f&&Hb(f)?b+(" "+H(f)):b+(" "+f);return b}
function Ib(a,b){if(Jb(la.process))return function(){return Ib(a,b).apply(this,arguments)};if(!0===Cb.noDeprecation)return a;var c=!1;return function(){if(!c){if(Cb.throwDeprecation)throw Error(b);Cb.traceDeprecation?console.trace(b):console.error(b);c=!0;}return a.apply(this,arguments)}}var Kb={},Lb;
function Mb(a){Jb(Lb)&&(Lb=Cb.env.NODE_DEBUG||"");a=a.toUpperCase();Kb[a]||((new RegExp("\\b"+a+"\\b","i")).test(Lb)?Kb[a]=function(){var b=Fb.apply(null,arguments);console.error("%s %d: %s",a,0,b);}:Kb[a]=function(){});return Kb[a]}
function H(a,b){var c={seen:[],stylize:Nb};3<=arguments.length&&(c.depth=arguments[2]);4<=arguments.length&&(c.colors=arguments[3]);Ob(b)?c.showHidden=b:b&&Pb(c,b);Jb(c.showHidden)&&(c.showHidden=!1);Jb(c.depth)&&(c.depth=2);Jb(c.colors)&&(c.colors=!1);Jb(c.customInspect)&&(c.customInspect=!0);c.colors&&(c.stylize=Qb);return Rb(c,a,c.depth)}
H.colors={bold:[1,22],italic:[3,23],underline:[4,24],inverse:[7,27],white:[37,39],grey:[90,39],black:[30,39],blue:[34,39],cyan:[36,39],green:[32,39],magenta:[35,39],red:[31,39],yellow:[33,39]};H.styles={special:"cyan",number:"yellow","boolean":"yellow",undefined:"grey","null":"bold",string:"green",date:"magenta",regexp:"red"};function Qb(a,b){return (b=H.styles[b])?"\u001b["+H.colors[b][0]+"m"+a+"\u001b["+H.colors[b][1]+"m":a}function Nb(a){return a}
function Sb(a){var b={};a.forEach(function(a){b[a]=!0;});return b}
function Rb(a,b,c){if(a.customInspect&&b&&Tb(b.inspect)&&b.inspect!==H&&(!b.constructor||b.constructor.prototype!==b)){var d=b.inspect(c,a);Gb(d)||(d=Rb(a,d,c));return d}if(d=Ub(a,b))return d;var e=Object.keys(b),f=Sb(e);a.showHidden&&(e=Object.getOwnPropertyNames(b));if(Vb(b)&&(0<=e.indexOf("message")||0<=e.indexOf("description")))return Zb(b);if(0===e.length){if(Tb(b))return a.stylize("[Function"+(b.name?": "+b.name:"")+"]","special");if(ac(b))return a.stylize(RegExp.prototype.toString.call(b),
"regexp");if(bc(b))return a.stylize(Date.prototype.toString.call(b),"date");if(Vb(b))return Zb(b)}d="";var g=!1,h=["{","}"];cc(b)&&(g=!0,h=["[","]"]);Tb(b)&&(d=" [Function"+(b.name?": "+b.name:"")+"]");ac(b)&&(d=" "+RegExp.prototype.toString.call(b));bc(b)&&(d=" "+Date.prototype.toUTCString.call(b));Vb(b)&&(d=" "+Zb(b));if(0===e.length&&(!g||0==b.length))return h[0]+d+h[1];if(0>c)return ac(b)?a.stylize(RegExp.prototype.toString.call(b),"regexp"):a.stylize("[Object]","special");a.seen.push(b);e=g?
dc(a,b,c,f,e):e.map(function(d){return ec(a,b,c,f,d,g)});a.seen.pop();return fc(e,d,h)}function Ub(a,b){if(Jb(b))return a.stylize("undefined","undefined");if(Gb(b))return b="'"+JSON.stringify(b).replace(/^"|"$/g,"").replace(/'/g,"\\'").replace(/\\"/g,'"')+"'",a.stylize(b,"string");if(gc(b))return a.stylize(""+b,"number");if(Ob(b))return a.stylize(""+b,"boolean");if(null===b)return a.stylize("null","null")}function Zb(a){return "["+Error.prototype.toString.call(a)+"]"}
function dc(a,b,c,d,e){for(var f=[],g=0,h=b.length;g<h;++g)Object.prototype.hasOwnProperty.call(b,String(g))?f.push(ec(a,b,c,d,String(g),!0)):f.push("");e.forEach(function(e){e.match(/^\d+$/)||f.push(ec(a,b,c,d,e,!0));});return f}
function ec(a,b,c,d,e,f){var g,h;b=Object.getOwnPropertyDescriptor(b,e)||{value:b[e]};b.get?h=b.set?a.stylize("[Getter/Setter]","special"):a.stylize("[Getter]","special"):b.set&&(h=a.stylize("[Setter]","special"));Object.prototype.hasOwnProperty.call(d,e)||(g="["+e+"]");h||(0>a.seen.indexOf(b.value)?(h=null===c?Rb(a,b.value,null):Rb(a,b.value,c-1),-1<h.indexOf("\n")&&(h=f?h.split("\n").map(function(a){return "  "+a}).join("\n").substr(2):"\n"+h.split("\n").map(function(a){return "   "+a}).join("\n"))):
h=a.stylize("[Circular]","special"));if(Jb(g)){if(f&&e.match(/^\d+$/))return h;g=JSON.stringify(""+e);g.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)?(g=g.substr(1,g.length-2),g=a.stylize(g,"name")):(g=g.replace(/'/g,"\\'").replace(/\\"/g,'"').replace(/(^"|"$)/g,"'"),g=a.stylize(g,"string"));}return g+": "+h}
function fc(a,b,c){return 60<a.reduce(function(a,b){b.indexOf("\n");return a+b.replace(/\u001b\[\d\d?m/g,"").length+1},0)?c[0]+(""===b?"":b+"\n ")+" "+a.join(",\n  ")+" "+c[1]:c[0]+b+" "+a.join(", ")+" "+c[1]}function cc(a){return Array.isArray(a)}function Ob(a){return "boolean"===typeof a}function gc(a){return "number"===typeof a}function Gb(a){return "string"===typeof a}function Jb(a){return void 0===a}function ac(a){return Hb(a)&&"[object RegExp]"===Object.prototype.toString.call(a)}
function Hb(a){return "object"===typeof a&&null!==a}function bc(a){return Hb(a)&&"[object Date]"===Object.prototype.toString.call(a)}function Vb(a){return Hb(a)&&("[object Error]"===Object.prototype.toString.call(a)||a instanceof Error)}function Tb(a){return "function"===typeof a}function hc(a){return null===a||"boolean"===typeof a||"number"===typeof a||"string"===typeof a||"symbol"===typeof a||"undefined"===typeof a}function ic(a){return 10>a?"0"+a.toString(10):a.toString(10)}var jc="Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
function kc(){var a=new Date,b=[ic(a.getHours()),ic(a.getMinutes()),ic(a.getSeconds())].join(":");return [a.getDate(),jc[a.getMonth()],b].join(" ")}function Pb(a,b){if(!b||!Hb(b))return a;for(var c=Object.keys(b),d=c.length;d--;)a[c[d]]=b[c[d]];return a}
var lc={inherits:Db,_extend:Pb,log:function(){console.log("%s - %s",kc(),Fb.apply(null,arguments));},isBuffer:function(a){return Na(a)},isPrimitive:hc,isFunction:Tb,isError:Vb,isDate:bc,isObject:Hb,isRegExp:ac,isUndefined:Jb,isSymbol:function(a){return "symbol"===typeof a},isString:Gb,isNumber:gc,isNullOrUndefined:function(a){return null==a},isNull:function(a){return null===a},isBoolean:Ob,isArray:cc,inspect:H,deprecate:Ib,format:Fb,debuglog:Mb};
function mc(a,b){if(a===b)return 0;for(var c=a.length,d=b.length,e=0,f=Math.min(c,d);e<f;++e)if(a[e]!==b[e]){c=a[e];d=b[e];break}return c<d?-1:d<c?1:0}var nc=Object.prototype.hasOwnProperty,oc=Object.keys||function(a){var b=[],c;for(c in a)nc.call(a,c)&&b.push(c);return b},pc=Array.prototype.slice,qc;function rc(){return "undefined"!==typeof qc?qc:qc=function(){return "foo"===function(){}.name}()}
function sc(a){return Na(a)||"function"!==typeof la.ArrayBuffer?!1:"function"===typeof ArrayBuffer.isView?ArrayBuffer.isView(a):a?a instanceof DataView||a.buffer&&a.buffer instanceof ArrayBuffer?!0:!1:!1}function I(a,b){a||J(a,!0,b,"==",tc);}var uc=/\s*function\s+([^\(\s]*)\s*/;function vc(a){if(Tb(a))return rc()?a.name:(a=a.toString().match(uc))&&a[1]}I.AssertionError=wc;
function wc(a){this.name="AssertionError";this.actual=a.actual;this.expected=a.expected;this.operator=a.operator;a.message?(this.message=a.message,this.generatedMessage=!1):(this.message=xc(yc(this.actual),128)+" "+this.operator+" "+xc(yc(this.expected),128),this.generatedMessage=!0);var b=a.stackStartFunction||J;Error.captureStackTrace?Error.captureStackTrace(this,b):(a=Error(),a.stack&&(a=a.stack,b=vc(b),b=a.indexOf("\n"+b),0<=b&&(b=a.indexOf("\n",b+1),a=a.substring(b+1)),this.stack=a));}Db(wc,Error);
function xc(a,b){return "string"===typeof a?a.length<b?a:a.slice(0,b):a}function yc(a){if(rc()||!Tb(a))return H(a);a=vc(a);return "[Function"+(a?": "+a:"")+"]"}function J(a,b,c,d,e){throw new wc({message:c,actual:a,expected:b,operator:d,stackStartFunction:e});}I.fail=J;function tc(a,b){a||J(a,!0,b,"==",tc);}I.ok=tc;I.equal=zc;function zc(a,b,c){a!=b&&J(a,b,c,"==",zc);}I.notEqual=Ac;function Ac(a,b,c){a==b&&J(a,b,c,"!=",Ac);}I.deepEqual=Bc;function Bc(a,b,c){Cc(a,b,!1)||J(a,b,c,"deepEqual",Bc);}
I.deepStrictEqual=Dc;function Dc(a,b,c){Cc(a,b,!0)||J(a,b,c,"deepStrictEqual",Dc);}
function Cc(a,b,c,d){if(a===b)return !0;if(Na(a)&&Na(b))return 0===mc(a,b);if(bc(a)&&bc(b))return a.getTime()===b.getTime();if(ac(a)&&ac(b))return a.source===b.source&&a.global===b.global&&a.multiline===b.multiline&&a.lastIndex===b.lastIndex&&a.ignoreCase===b.ignoreCase;if(null!==a&&"object"===typeof a||null!==b&&"object"===typeof b){if(!sc(a)||!sc(b)||Object.prototype.toString.call(a)!==Object.prototype.toString.call(b)||a instanceof Float32Array||a instanceof Float64Array){if(Na(a)!==Na(b))return !1;
d=d||{actual:[],expected:[]};var e=d.actual.indexOf(a);if(-1!==e&&e===d.expected.indexOf(b))return !0;d.actual.push(a);d.expected.push(b);return Ec(a,b,c,d)}return 0===mc(new Uint8Array(a.buffer),new Uint8Array(b.buffer))}return c?a===b:a==b}function Fc(a){return "[object Arguments]"==Object.prototype.toString.call(a)}
function Ec(a,b,c,d){if(null===a||void 0===a||null===b||void 0===b)return !1;if(hc(a)||hc(b))return a===b;if(c&&Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return !1;var e=Fc(a),f=Fc(b);if(e&&!f||!e&&f)return !1;if(e)return a=pc.call(a),b=pc.call(b),Cc(a,b,c);e=oc(a);var g=oc(b);if(e.length!==g.length)return !1;e.sort();g.sort();for(f=e.length-1;0<=f;f--)if(e[f]!==g[f])return !1;for(f=e.length-1;0<=f;f--)if(g=e[f],!Cc(a[g],b[g],c,d))return !1;return !0}I.notDeepEqual=Gc;
function Gc(a,b,c){Cc(a,b,!1)&&J(a,b,c,"notDeepEqual",Gc);}I.notDeepStrictEqual=Hc;function Hc(a,b,c){Cc(a,b,!0)&&J(a,b,c,"notDeepStrictEqual",Hc);}I.strictEqual=Ic;function Ic(a,b,c){a!==b&&J(a,b,c,"===",Ic);}I.notStrictEqual=Jc;function Jc(a,b,c){a===b&&J(a,b,c,"!==",Jc);}function Kc(a,b){if(!a||!b)return !1;if("[object RegExp]"==Object.prototype.toString.call(b))return b.test(a);try{if(a instanceof b)return !0}catch(c){}return Error.isPrototypeOf(b)?!1:!0===b.call({},a)}
function Lc(a,b,c,d){if("function"!==typeof b)throw new TypeError('"block" argument must be a function');"string"===typeof c&&(d=c,c=null);try{b();}catch(h){var e=h;}b=e;d=(c&&c.name?" ("+c.name+").":".")+(d?" "+d:".");a&&!b&&J(b,c,"Missing expected exception"+d);e="string"===typeof d;var f=!a&&Vb(b),g=!a&&b&&!c;(f&&e&&Kc(b,c)||g)&&J(b,c,"Got unwanted exception"+d);if(a&&b&&c&&!Kc(b,c)||!a&&b)throw b;}I.throws=Mc;function Mc(a,b,c){Lc(!0,a,b,c);}I.doesNotThrow=Nc;function Nc(a,b,c){Lc(!1,a,b,c);}
I.ifError=Oc;function Oc(a){if(a)throw a;}
var Pc=u(function(a,b){function c(a){return function(a){function b(b){for(var c=[],e=1;e<arguments.length;e++)c[e-1]=arguments[e];c=a.call(this,d(b,c))||this;c.code=b;c[h]=b;c.name=a.prototype.name+" ["+c[h]+"]";return c}g(b,a);return b}(a)}function d(a,b){I.strictEqual(typeof a,"string");var c=k[a];I(c,"An invalid error message key was used: "+a+".");if("function"===typeof c)a=c;else {a=lc.format;if(void 0===b||0===b.length)return c;b.unshift(c);}return String(a.apply(null,b))}function e(a,b){k[a]=
"function"===typeof b?b:String(b);}function f(a,b){I(a,"expected is required");I("string"===typeof b,"thing is required");if(Array.isArray(a)){var c=a.length;I(0<c,"At least one expected value needs to be specified");a=a.map(function(a){return String(a)});return 2<c?"one of "+b+" "+a.slice(0,c-1).join(", ")+", or "+a[c-1]:2===c?"one of "+b+" "+a[0]+" or "+a[1]:"of "+b+" "+a[0]}return "of "+b+" "+String(a)}var g=l&&l.__extends||function(){function a(b,c){a=Object.setPrototypeOf||{__proto__:[]}instanceof
Array&&function(a,b){a.__proto__=b;}||function(a,b){for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);};return a(b,c)}return function(b,c){function d(){this.constructor=b;}a(b,c);b.prototype=null===c?Object.create(c):(d.prototype=c.prototype,new d);}}();Object.defineProperty(b,"__esModule",{value:!0});var h="undefined"===typeof Symbol?"_kCode":Symbol("code"),k={};a=function(a){function c(c){if("object"!==typeof c||null===c)throw new b.TypeError("ERR_INVALID_ARG_TYPE","options","object");var d=c.message?
a.call(this,c.message)||this:a.call(this,lc.inspect(c.actual).slice(0,128)+" "+(c.operator+" "+lc.inspect(c.expected).slice(0,128)))||this;d.generatedMessage=!c.message;d.name="AssertionError [ERR_ASSERTION]";d.code="ERR_ASSERTION";d.actual=c.actual;d.expected=c.expected;d.operator=c.operator;b.Error.captureStackTrace(d,c.stackStartFunction);return d}g(c,a);return c}(l.Error);b.AssertionError=a;b.message=d;b.E=e;b.Error=c(l.Error);b.TypeError=c(l.TypeError);b.RangeError=c(l.RangeError);e("ERR_ARG_NOT_ITERABLE",
"%s must be iterable");e("ERR_ASSERTION","%s");e("ERR_BUFFER_OUT_OF_BOUNDS",function(a,b){return b?"Attempt to write outside buffer bounds":'"'+a+'" is outside of buffer bounds'});e("ERR_CHILD_CLOSED_BEFORE_REPLY","Child closed before reply received");e("ERR_CONSOLE_WRITABLE_STREAM","Console expects a writable stream instance for %s");e("ERR_CPU_USAGE","Unable to obtain cpu usage %s");e("ERR_DNS_SET_SERVERS_FAILED",function(a,b){return 'c-ares failed to set servers: "'+a+'" ['+b+"]"});e("ERR_FALSY_VALUE_REJECTION",
"Promise was rejected with falsy value");e("ERR_ENCODING_NOT_SUPPORTED",function(a){return 'The "'+a+'" encoding is not supported'});e("ERR_ENCODING_INVALID_ENCODED_DATA",function(a){return "The encoded data was not valid for encoding "+a});e("ERR_HTTP_HEADERS_SENT","Cannot render headers after they are sent to the client");e("ERR_HTTP_INVALID_STATUS_CODE","Invalid status code: %s");e("ERR_HTTP_TRAILER_INVALID","Trailers are invalid with this transfer encoding");e("ERR_INDEX_OUT_OF_RANGE","Index out of range");
e("ERR_INVALID_ARG_TYPE",function(a,b,c){I(a,"name is required");if(b.includes("not ")){var d="must not be";b=b.split("not ")[1];}else d="must be";if(Array.isArray(a))d="The "+a.map(function(a){return '"'+a+'"'}).join(", ")+" arguments "+d+" "+f(b,"type");else if(a.includes(" argument"))d="The "+a+" "+d+" "+f(b,"type");else {var e=a.includes(".")?"property":"argument";d='The "'+a+'" '+e+" "+d+" "+f(b,"type");}3<=arguments.length&&(d+=". Received type "+(null!==c?typeof c:"null"));return d});e("ERR_INVALID_ARRAY_LENGTH",
function(a,b,c){I.strictEqual(typeof c,"number");return 'The array "'+a+'" (length '+c+") must be of length "+b+"."});e("ERR_INVALID_BUFFER_SIZE","Buffer size must be a multiple of %s");e("ERR_INVALID_CALLBACK","Callback must be a function");e("ERR_INVALID_CHAR","Invalid character in %s");e("ERR_INVALID_CURSOR_POS","Cannot set cursor row without setting its column");e("ERR_INVALID_FD",'"fd" must be a positive integer: %s');e("ERR_INVALID_FILE_URL_HOST",'File URL host must be "localhost" or empty on %s');
e("ERR_INVALID_FILE_URL_PATH","File URL path %s");e("ERR_INVALID_HANDLE_TYPE","This handle type cannot be sent");e("ERR_INVALID_IP_ADDRESS","Invalid IP address: %s");e("ERR_INVALID_OPT_VALUE",function(a,b){return 'The value "'+String(b)+'" is invalid for option "'+a+'"'});e("ERR_INVALID_OPT_VALUE_ENCODING",function(a){return 'The value "'+String(a)+'" is invalid for option "encoding"'});e("ERR_INVALID_REPL_EVAL_CONFIG",'Cannot specify both "breakEvalOnSigint" and "eval" for REPL');e("ERR_INVALID_SYNC_FORK_INPUT",
"Asynchronous forks do not support Buffer, Uint8Array or string input: %s");e("ERR_INVALID_THIS",'Value of "this" must be of type %s');e("ERR_INVALID_TUPLE","%s must be an iterable %s tuple");e("ERR_INVALID_URL","Invalid URL: %s");e("ERR_INVALID_URL_SCHEME",function(a){return "The URL must be "+f(a,"scheme")});e("ERR_IPC_CHANNEL_CLOSED","Channel closed");e("ERR_IPC_DISCONNECTED","IPC channel is already disconnected");e("ERR_IPC_ONE_PIPE","Child process can have only one IPC pipe");e("ERR_IPC_SYNC_FORK",
"IPC cannot be used with synchronous forks");e("ERR_MISSING_ARGS",function(){for(var a=[],b=0;b<arguments.length;b++)a[b]=arguments[b];I(0<a.length,"At least one arg needs to be specified");b="The ";var c=a.length;a=a.map(function(a){return '"'+a+'"'});switch(c){case 1:b+=a[0]+" argument";break;case 2:b+=a[0]+" and "+a[1]+" arguments";break;default:b+=a.slice(0,c-1).join(", "),b+=", and "+a[c-1]+" arguments";}return b+" must be specified"});e("ERR_MULTIPLE_CALLBACK","Callback called multiple times");
e("ERR_NAPI_CONS_FUNCTION","Constructor must be a function");e("ERR_NAPI_CONS_PROTOTYPE_OBJECT","Constructor.prototype must be an object");e("ERR_NO_CRYPTO","Node.js is not compiled with OpenSSL crypto support");e("ERR_NO_LONGER_SUPPORTED","%s is no longer supported");e("ERR_PARSE_HISTORY_DATA","Could not parse history data in %s");e("ERR_SOCKET_ALREADY_BOUND","Socket is already bound");e("ERR_SOCKET_BAD_PORT","Port should be > 0 and < 65536");e("ERR_SOCKET_BAD_TYPE","Bad socket type specified. Valid types are: udp4, udp6");
e("ERR_SOCKET_CANNOT_SEND","Unable to send data");e("ERR_SOCKET_CLOSED","Socket is closed");e("ERR_SOCKET_DGRAM_NOT_RUNNING","Not running");e("ERR_STDERR_CLOSE","process.stderr cannot be closed");e("ERR_STDOUT_CLOSE","process.stdout cannot be closed");e("ERR_STREAM_WRAP","Stream has StringDecoder set or is in objectMode");e("ERR_TLS_CERT_ALTNAME_INVALID","Hostname/IP does not match certificate's altnames: %s");e("ERR_TLS_DH_PARAM_SIZE",function(a){return "DH parameter size "+a+" is less than 2048"});
e("ERR_TLS_HANDSHAKE_TIMEOUT","TLS handshake timeout");e("ERR_TLS_RENEGOTIATION_FAILED","Failed to renegotiate");e("ERR_TLS_REQUIRED_SERVER_NAME",'"servername" is required parameter for Server.addContext');e("ERR_TLS_SESSION_ATTACK","TSL session renegotiation attack detected");e("ERR_TRANSFORM_ALREADY_TRANSFORMING","Calling transform done when still transforming");e("ERR_TRANSFORM_WITH_LENGTH_0","Calling transform done when writableState.length != 0");e("ERR_UNKNOWN_ENCODING","Unknown encoding: %s");
e("ERR_UNKNOWN_SIGNAL","Unknown signal: %s");e("ERR_UNKNOWN_STDIN_TYPE","Unknown stdin file type");e("ERR_UNKNOWN_STREAM_TYPE","Unknown stream file type");e("ERR_V8BREAKITERATOR","Full ICU data not installed. See https://github.com/nodejs/node/wiki/Intl");});t(Pc);
var K=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});b.ENCODING_UTF8="utf8";b.assertEncoding=function(a){if(a&&!F.Buffer.isEncoding(a))throw new Pc.TypeError("ERR_INVALID_OPT_VALUE_ENCODING",a);};b.strToEncoding=function(a,d){return d&&d!==b.ENCODING_UTF8?"buffer"===d?new F.Buffer(a):(new F.Buffer(a)).toString(d):a};});t(K);
var Qc=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});var c=w.constants.S_IFMT,d=w.constants.S_IFDIR,e=w.constants.S_IFREG,f=w.constants.S_IFBLK,g=w.constants.S_IFCHR,h=w.constants.S_IFLNK,k=w.constants.S_IFIFO,p=w.constants.S_IFSOCK;a=function(){function a(){this.name="";this.mode=0;}a.build=function(b,c){var d=new a,e=b.getNode().mode;d.name=K.strToEncoding(b.getName(),c);d.mode=e;return d};a.prototype._checkModeProperty=function(a){return (this.mode&c)===a};a.prototype.isDirectory=
function(){return this._checkModeProperty(d)};a.prototype.isFile=function(){return this._checkModeProperty(e)};a.prototype.isBlockDevice=function(){return this._checkModeProperty(f)};a.prototype.isCharacterDevice=function(){return this._checkModeProperty(g)};a.prototype.isSymbolicLink=function(){return this._checkModeProperty(h)};a.prototype.isFIFO=function(){return this._checkModeProperty(k)};a.prototype.isSocket=function(){return this._checkModeProperty(p)};return a}();b.Dirent=a;b.default=a;});
t(Qc);function Rc(a,b){for(var c=0,d=a.length-1;0<=d;d--){var e=a[d];"."===e?a.splice(d,1):".."===e?(a.splice(d,1),c++):c&&(a.splice(d,1),c--);}if(b)for(;c--;c)a.unshift("..");return a}var Sc=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
function Tc(){for(var a="",b=!1,c=arguments.length-1;-1<=c&&!b;c--){var d=0<=c?arguments[c]:"/";if("string"!==typeof d)throw new TypeError("Arguments to path.resolve must be strings");d&&(a=d+"/"+a,b="/"===d.charAt(0));}a=Rc(Uc(a.split("/"),function(a){return !!a}),!b).join("/");return (b?"/":"")+a||"."}function Vc(a){var b=Wc(a),c="/"===Xc(a,-1);(a=Rc(Uc(a.split("/"),function(a){return !!a}),!b).join("/"))||b||(a=".");a&&c&&(a+="/");return (b?"/":"")+a}function Wc(a){return "/"===a.charAt(0)}
function Yc(a,b){function c(a){for(var b=0;b<a.length&&""===a[b];b++);for(var c=a.length-1;0<=c&&""===a[c];c--);return b>c?[]:a.slice(b,c-b+1)}a=Tc(a).substr(1);b=Tc(b).substr(1);a=c(a.split("/"));b=c(b.split("/"));for(var d=Math.min(a.length,b.length),e=d,f=0;f<d;f++)if(a[f]!==b[f]){e=f;break}d=[];for(f=e;f<a.length;f++)d.push("..");d=d.concat(b.slice(e));return d.join("/")}
var Zc={extname:function(a){return Sc.exec(a).slice(1)[3]},basename:function(a,b){a=Sc.exec(a).slice(1)[2];b&&a.substr(-1*b.length)===b&&(a=a.substr(0,a.length-b.length));return a},dirname:function(a){var b=Sc.exec(a).slice(1);a=b[0];b=b[1];if(!a&&!b)return ".";b&&(b=b.substr(0,b.length-1));return a+b},sep:"/",delimiter:":",relative:Yc,join:function(){var a=Array.prototype.slice.call(arguments,0);return Vc(Uc(a,function(a){if("string"!==typeof a)throw new TypeError("Arguments to path.join must be strings");
return a}).join("/"))},isAbsolute:Wc,normalize:Vc,resolve:Tc};function Uc(a,b){if(a.filter)return a.filter(b);for(var c=[],d=0;d<a.length;d++)b(a[d],d,a)&&c.push(a[d]);return c}var Xc="b"==="ab".substr(-1)?function(a,b,c){return a.substr(b,c)}:function(a,b,c){0>b&&(b=a.length+b);return a.substr(b,c)},$c=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});a="function"===typeof setImmediate?setImmediate.bind(l):setTimeout.bind(l);b.default=a;});t($c);
var L=u(function(a,b){function c(){var a=Cb||{};a.getuid||(a.getuid=function(){return 0});a.getgid||(a.getgid=function(){return 0});a.cwd||(a.cwd=function(){return "/"});a.nextTick||(a.nextTick=$c.default);a.emitWarning||(a.emitWarning=function(a,b){console.warn(""+b+(b?": ":"")+a);});a.env||(a.env={});return a}Object.defineProperty(b,"__esModule",{value:!0});b.createProcess=c;b.default=c();});t(L);function ad(){}ad.prototype=Object.create(null);function O(){O.init.call(this);}O.EventEmitter=O;
O.usingDomains=!1;O.prototype.domain=void 0;O.prototype._events=void 0;O.prototype._maxListeners=void 0;O.defaultMaxListeners=10;O.init=function(){this.domain=null;this._events&&this._events!==Object.getPrototypeOf(this)._events||(this._events=new ad,this._eventsCount=0);this._maxListeners=this._maxListeners||void 0;};O.prototype.setMaxListeners=function(a){if("number"!==typeof a||0>a||isNaN(a))throw new TypeError('"n" argument must be a positive number');this._maxListeners=a;return this};
O.prototype.getMaxListeners=function(){return void 0===this._maxListeners?O.defaultMaxListeners:this._maxListeners};
O.prototype.emit=function(a){var b,c;var d="error"===a;if(b=this._events)d=d&&null==b.error;else if(!d)return !1;var e=this.domain;if(d){b=arguments[1];if(e)b||(b=Error('Uncaught, unspecified "error" event')),b.domainEmitter=this,b.domain=e,b.domainThrown=!1,e.emit("error",b);else {if(b instanceof Error)throw b;e=Error('Uncaught, unspecified "error" event. ('+b+")");e.context=b;throw e;}return !1}e=b[a];if(!e)return !1;b="function"===typeof e;var f=arguments.length;switch(f){case 1:if(b)e.call(this);
else for(b=e.length,e=bd(e,b),d=0;d<b;++d)e[d].call(this);break;case 2:d=arguments[1];if(b)e.call(this,d);else for(b=e.length,e=bd(e,b),f=0;f<b;++f)e[f].call(this,d);break;case 3:d=arguments[1];f=arguments[2];if(b)e.call(this,d,f);else for(b=e.length,e=bd(e,b),c=0;c<b;++c)e[c].call(this,d,f);break;case 4:d=arguments[1];f=arguments[2];c=arguments[3];if(b)e.call(this,d,f,c);else {b=e.length;e=bd(e,b);for(var g=0;g<b;++g)e[g].call(this,d,f,c);}break;default:d=Array(f-1);for(c=1;c<f;c++)d[c-1]=arguments[c];
if(b)e.apply(this,d);else for(b=e.length,e=bd(e,b),f=0;f<b;++f)e[f].apply(this,d);}return !0};
function cd(a,b,c,d){var e;if("function"!==typeof c)throw new TypeError('"listener" argument must be a function');if(e=a._events){e.newListener&&(a.emit("newListener",b,c.listener?c.listener:c),e=a._events);var f=e[b];}else e=a._events=new ad,a._eventsCount=0;f?("function"===typeof f?f=e[b]=d?[c,f]:[f,c]:d?f.unshift(c):f.push(c),f.warned||(c=void 0===a._maxListeners?O.defaultMaxListeners:a._maxListeners)&&0<c&&f.length>c&&(f.warned=!0,c=Error("Possible EventEmitter memory leak detected. "+f.length+
" "+b+" listeners added. Use emitter.setMaxListeners() to increase limit"),c.name="MaxListenersExceededWarning",c.emitter=a,c.type=b,c.count=f.length,"function"===typeof console.warn?console.warn(c):console.log(c))):(e[b]=c,++a._eventsCount);return a}O.prototype.addListener=function(a,b){return cd(this,a,b,!1)};O.prototype.on=O.prototype.addListener;O.prototype.prependListener=function(a,b){return cd(this,a,b,!0)};
function dd(a,b,c){function d(){a.removeListener(b,d);e||(e=!0,c.apply(a,arguments));}var e=!1;d.listener=c;return d}O.prototype.once=function(a,b){if("function"!==typeof b)throw new TypeError('"listener" argument must be a function');this.on(a,dd(this,a,b));return this};O.prototype.prependOnceListener=function(a,b){if("function"!==typeof b)throw new TypeError('"listener" argument must be a function');this.prependListener(a,dd(this,a,b));return this};
O.prototype.removeListener=function(a,b){var c;if("function"!==typeof b)throw new TypeError('"listener" argument must be a function');var d=this._events;if(!d)return this;var e=d[a];if(!e)return this;if(e===b||e.listener&&e.listener===b)0===--this._eventsCount?this._events=new ad:(delete d[a],d.removeListener&&this.emit("removeListener",a,e.listener||b));else if("function"!==typeof e){var f=-1;for(c=e.length;0<c--;)if(e[c]===b||e[c].listener&&e[c].listener===b){var g=e[c].listener;f=c;break}if(0>
f)return this;if(1===e.length){e[0]=void 0;if(0===--this._eventsCount)return this._events=new ad,this;delete d[a];}else {c=f+1;for(var h=e.length;c<h;f+=1,c+=1)e[f]=e[c];e.pop();}d.removeListener&&this.emit("removeListener",a,g||b);}return this};
O.prototype.removeAllListeners=function(a){var b=this._events;if(!b)return this;if(!b.removeListener)return 0===arguments.length?(this._events=new ad,this._eventsCount=0):b[a]&&(0===--this._eventsCount?this._events=new ad:delete b[a]),this;if(0===arguments.length){b=Object.keys(b);for(var c=0,d;c<b.length;++c)d=b[c],"removeListener"!==d&&this.removeAllListeners(d);this.removeAllListeners("removeListener");this._events=new ad;this._eventsCount=0;return this}b=b[a];if("function"===typeof b)this.removeListener(a,
b);else if(b){do this.removeListener(a,b[b.length-1]);while(b[0])}return this};O.prototype.listeners=function(a){var b=this._events;if(b)if(a=b[a])if("function"===typeof a)a=[a.listener||a];else {b=Array(a.length);for(var c=0;c<b.length;++c)b[c]=a[c].listener||a[c];a=b;}else a=[];else a=[];return a};O.listenerCount=function(a,b){return "function"===typeof a.listenerCount?a.listenerCount(b):ed.call(a,b)};O.prototype.listenerCount=ed;
function ed(a){var b=this._events;if(b){a=b[a];if("function"===typeof a)return 1;if(a)return a.length}return 0}O.prototype.eventNames=function(){return 0<this._eventsCount?Reflect.ownKeys(this._events):[]};function bd(a,b){for(var c=Array(b);b--;)c[b]=a[b];return c}
var fd=u(function(a,b){var c=l&&l.__extends||function(){function a(b,c){a=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(a,b){a.__proto__=b;}||function(a,b){for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);};return a(b,c)}return function(b,c){function d(){this.constructor=b;}a(b,c);b.prototype=null===c?Object.create(c):(d.prototype=c.prototype,new d);}}();Object.defineProperty(b,"__esModule",{value:!0});var d=w.constants.S_IFMT,e=w.constants.S_IFDIR,f=w.constants.S_IFREG,g=w.constants.S_IFLNK,
h=w.constants.O_APPEND;b.SEP="/";a=function(a){function b(b,c){void 0===c&&(c=438);var d=a.call(this)||this;d.uid=L.default.getuid();d.gid=L.default.getgid();d.atime=new Date;d.mtime=new Date;d.ctime=new Date;d.perm=438;d.mode=f;d.nlink=1;d.perm=c;d.mode|=c;d.ino=b;return d}c(b,a);b.prototype.getString=function(a){void 0===a&&(a="utf8");return this.getBuffer().toString(a)};b.prototype.setString=function(a){this.buf=F.bufferFrom(a,"utf8");this.touch();};b.prototype.getBuffer=function(){this.buf||this.setBuffer(F.bufferAllocUnsafe(0));
return F.bufferFrom(this.buf)};b.prototype.setBuffer=function(a){this.buf=F.bufferFrom(a);this.touch();};b.prototype.getSize=function(){return this.buf?this.buf.length:0};b.prototype.setModeProperty=function(a){this.mode=this.mode&~d|a;};b.prototype.setIsFile=function(){this.setModeProperty(f);};b.prototype.setIsDirectory=function(){this.setModeProperty(e);};b.prototype.setIsSymlink=function(){this.setModeProperty(g);};b.prototype.isFile=function(){return (this.mode&d)===f};b.prototype.isDirectory=function(){return (this.mode&
d)===e};b.prototype.isSymlink=function(){return (this.mode&d)===g};b.prototype.makeSymlink=function(a){this.symlink=a;this.setIsSymlink();};b.prototype.write=function(a,b,c,d){void 0===b&&(b=0);void 0===c&&(c=a.length);void 0===d&&(d=0);this.buf||(this.buf=F.bufferAllocUnsafe(0));if(d+c>this.buf.length){var e=F.bufferAllocUnsafe(d+c);this.buf.copy(e,0,0,this.buf.length);this.buf=e;}a.copy(this.buf,d,b,b+c);this.touch();return c};b.prototype.read=function(a,b,c,d){void 0===b&&(b=0);void 0===c&&(c=a.byteLength);
void 0===d&&(d=0);this.buf||(this.buf=F.bufferAllocUnsafe(0));c>a.byteLength&&(c=a.byteLength);c+d>this.buf.length&&(c=this.buf.length-d);this.buf.copy(a,b,d,d+c);return c};b.prototype.truncate=function(a){void 0===a&&(a=0);if(a)if(this.buf||(this.buf=F.bufferAllocUnsafe(0)),a<=this.buf.length)this.buf=this.buf.slice(0,a);else {var b=F.bufferAllocUnsafe(0);this.buf.copy(b);b.fill(0,a);}else this.buf=F.bufferAllocUnsafe(0);this.touch();};b.prototype.chmod=function(a){this.perm=a;this.mode=this.mode&-512|
a;this.touch();};b.prototype.chown=function(a,b){this.uid=a;this.gid=b;this.touch();};b.prototype.touch=function(){this.mtime=new Date;this.emit("change",this);};b.prototype.canRead=function(a,b){void 0===a&&(a=L.default.getuid());void 0===b&&(b=L.default.getgid());return this.perm&4||b===this.gid&&this.perm&32||a===this.uid&&this.perm&256?!0:!1};b.prototype.canWrite=function(a,b){void 0===a&&(a=L.default.getuid());void 0===b&&(b=L.default.getgid());return this.perm&2||b===this.gid&&this.perm&16||a===
this.uid&&this.perm&128?!0:!1};b.prototype.del=function(){this.emit("delete",this);};b.prototype.toJSON=function(){return {ino:this.ino,uid:this.uid,gid:this.gid,atime:this.atime.getTime(),mtime:this.mtime.getTime(),ctime:this.ctime.getTime(),perm:this.perm,mode:this.mode,nlink:this.nlink,symlink:this.symlink,data:this.getString()}};return b}(O.EventEmitter);b.Node=a;a=function(a){function d(b,c,d){var e=a.call(this)||this;e.children={};e.steps=[];e.ino=0;e.length=0;e.vol=b;e.parent=c;e.steps=c?c.steps.concat([d]):
[d];return e}c(d,a);d.prototype.setNode=function(a){this.node=a;this.ino=a.ino;};d.prototype.getNode=function(){return this.node};d.prototype.createChild=function(a,b){void 0===b&&(b=this.vol.createNode());var c=new d(this.vol,this,a);c.setNode(b);b.isDirectory();this.setChild(a,c);return c};d.prototype.setChild=function(a,b){void 0===b&&(b=new d(this.vol,this,a));this.children[a]=b;b.parent=this;this.length++;this.emit("child:add",b,this);return b};d.prototype.deleteChild=function(a){delete this.children[a.getName()];
this.length--;this.emit("child:delete",a,this);};d.prototype.getChild=function(a){if(Object.hasOwnProperty.call(this.children,a))return this.children[a]};d.prototype.getPath=function(){return this.steps.join(b.SEP)};d.prototype.getName=function(){return this.steps[this.steps.length-1]};d.prototype.walk=function(a,b,c){void 0===b&&(b=a.length);void 0===c&&(c=0);if(c>=a.length||c>=b)return this;var d=this.getChild(a[c]);return d?d.walk(a,b,c+1):null};d.prototype.toJSON=function(){return {steps:this.steps,
ino:this.ino,children:Object.keys(this.children)}};return d}(O.EventEmitter);b.Link=a;a=function(){function a(a,b,c,d){this.position=0;this.link=a;this.node=b;this.flags=c;this.fd=d;}a.prototype.getString=function(){return this.node.getString()};a.prototype.setString=function(a){this.node.setString(a);};a.prototype.getBuffer=function(){return this.node.getBuffer()};a.prototype.setBuffer=function(a){this.node.setBuffer(a);};a.prototype.getSize=function(){return this.node.getSize()};a.prototype.truncate=
function(a){this.node.truncate(a);};a.prototype.seekTo=function(a){this.position=a;};a.prototype.stats=function(){return ka.default.build(this.node)};a.prototype.write=function(a,b,c,d){void 0===b&&(b=0);void 0===c&&(c=a.length);"number"!==typeof d&&(d=this.position);this.flags&h&&(d=this.getSize());a=this.node.write(a,b,c,d);this.position=d+a;return a};a.prototype.read=function(a,b,c,d){void 0===b&&(b=0);void 0===c&&(c=a.byteLength);"number"!==typeof d&&(d=this.position);a=this.node.read(a,b,c,d);
this.position=d+a;return a};a.prototype.chmod=function(a){this.node.chmod(a);};a.prototype.chown=function(a,b){this.node.chown(a,b);};return a}();b.File=a;});t(fd);var gd=fd.Node,hd=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});b.default=function(a,b,e){var c=setTimeout.apply(null,arguments);c&&"object"===typeof c&&"function"===typeof c.unref&&c.unref();return c};});t(hd);function id(){this.tail=this.head=null;this.length=0;}
id.prototype.push=function(a){a={data:a,next:null};0<this.length?this.tail.next=a:this.head=a;this.tail=a;++this.length;};id.prototype.unshift=function(a){a={data:a,next:this.head};0===this.length&&(this.tail=a);this.head=a;++this.length;};id.prototype.shift=function(){if(0!==this.length){var a=this.head.data;this.head=1===this.length?this.tail=null:this.head.next;--this.length;return a}};id.prototype.clear=function(){this.head=this.tail=null;this.length=0;};
id.prototype.join=function(a){if(0===this.length)return "";for(var b=this.head,c=""+b.data;b=b.next;)c+=a+b.data;return c};id.prototype.concat=function(a){if(0===this.length)return z.alloc(0);if(1===this.length)return this.head.data;a=z.allocUnsafe(a>>>0);for(var b=this.head,c=0;b;)b.data.copy(a,c),c+=b.data.length,b=b.next;return a};
var jd=z.isEncoding||function(a){switch(a&&a.toLowerCase()){case "hex":case "utf8":case "utf-8":case "ascii":case "binary":case "base64":case "ucs2":case "ucs-2":case "utf16le":case "utf-16le":case "raw":return !0;default:return !1}};
function kd(a){this.encoding=(a||"utf8").toLowerCase().replace(/[-_]/,"");if(a&&!jd(a))throw Error("Unknown encoding: "+a);switch(this.encoding){case "utf8":this.surrogateSize=3;break;case "ucs2":case "utf16le":this.surrogateSize=2;this.detectIncompleteChar=ld;break;case "base64":this.surrogateSize=3;this.detectIncompleteChar=md;break;default:this.write=nd;return}this.charBuffer=new z(6);this.charLength=this.charReceived=0;}
kd.prototype.write=function(a){for(var b="";this.charLength;){b=a.length>=this.charLength-this.charReceived?this.charLength-this.charReceived:a.length;a.copy(this.charBuffer,this.charReceived,0,b);this.charReceived+=b;if(this.charReceived<this.charLength)return "";a=a.slice(b,a.length);b=this.charBuffer.slice(0,this.charLength).toString(this.encoding);var c=b.charCodeAt(b.length-1);if(55296<=c&&56319>=c)this.charLength+=this.surrogateSize,b="";else {this.charReceived=this.charLength=0;if(0===a.length)return b;
break}}this.detectIncompleteChar(a);var d=a.length;this.charLength&&(a.copy(this.charBuffer,0,a.length-this.charReceived,d),d-=this.charReceived);b+=a.toString(this.encoding,0,d);d=b.length-1;c=b.charCodeAt(d);return 55296<=c&&56319>=c?(c=this.surrogateSize,this.charLength+=c,this.charReceived+=c,this.charBuffer.copy(this.charBuffer,c,0,c),a.copy(this.charBuffer,0,0,c),b.substring(0,d)):b};
kd.prototype.detectIncompleteChar=function(a){for(var b=3<=a.length?3:a.length;0<b;b--){var c=a[a.length-b];if(1==b&&6==c>>5){this.charLength=2;break}if(2>=b&&14==c>>4){this.charLength=3;break}if(3>=b&&30==c>>3){this.charLength=4;break}}this.charReceived=b;};kd.prototype.end=function(a){var b="";a&&a.length&&(b=this.write(a));this.charReceived&&(a=this.encoding,b+=this.charBuffer.slice(0,this.charReceived).toString(a));return b};function nd(a){return a.toString(this.encoding)}
function ld(a){this.charLength=(this.charReceived=a.length%2)?2:0;}function md(a){this.charLength=(this.charReceived=a.length%3)?3:0;}P.ReadableState=od;var Q=Mb("stream");Db(P,O);function pd(a,b,c){if("function"===typeof a.prependListener)return a.prependListener(b,c);if(a._events&&a._events[b])Array.isArray(a._events[b])?a._events[b].unshift(c):a._events[b]=[c,a._events[b]];else a.on(b,c);}
function od(a,b){a=a||{};this.objectMode=!!a.objectMode;b instanceof V&&(this.objectMode=this.objectMode||!!a.readableObjectMode);b=a.highWaterMark;var c=this.objectMode?16:16384;this.highWaterMark=b||0===b?b:c;this.highWaterMark=~~this.highWaterMark;this.buffer=new id;this.length=0;this.pipes=null;this.pipesCount=0;this.flowing=null;this.reading=this.endEmitted=this.ended=!1;this.sync=!0;this.resumeScheduled=this.readableListening=this.emittedReadable=this.needReadable=!1;this.defaultEncoding=a.defaultEncoding||
"utf8";this.ranOut=!1;this.awaitDrain=0;this.readingMore=!1;this.encoding=this.decoder=null;a.encoding&&(this.decoder=new kd(a.encoding),this.encoding=a.encoding);}function P(a){if(!(this instanceof P))return new P(a);this._readableState=new od(a,this);this.readable=!0;a&&"function"===typeof a.read&&(this._read=a.read);O.call(this);}
P.prototype.push=function(a,b){var c=this._readableState;c.objectMode||"string"!==typeof a||(b=b||c.defaultEncoding,b!==c.encoding&&(a=z.from(a,b),b=""));return qd(this,c,a,b,!1)};P.prototype.unshift=function(a){return qd(this,this._readableState,a,"",!0)};P.prototype.isPaused=function(){return !1===this._readableState.flowing};
function qd(a,b,c,d,e){var f=c;var g=null;Na(f)||"string"===typeof f||null===f||void 0===f||b.objectMode||(g=new TypeError("Invalid non-string/buffer chunk"));if(f=g)a.emit("error",f);else if(null===c)b.reading=!1,b.ended||(b.decoder&&(c=b.decoder.end())&&c.length&&(b.buffer.push(c),b.length+=b.objectMode?1:c.length),b.ended=!0,rd(a));else if(b.objectMode||c&&0<c.length)if(b.ended&&!e)a.emit("error",Error("stream.push() after EOF"));else if(b.endEmitted&&e)a.emit("error",Error("stream.unshift() after end event"));
else {if(b.decoder&&!e&&!d){c=b.decoder.write(c);var h=!b.objectMode&&0===c.length;}e||(b.reading=!1);h||(b.flowing&&0===b.length&&!b.sync?(a.emit("data",c),a.read(0)):(b.length+=b.objectMode?1:c.length,e?b.buffer.unshift(c):b.buffer.push(c),b.needReadable&&rd(a)));b.readingMore||(b.readingMore=!0,G(sd,a,b));}else e||(b.reading=!1);return !b.ended&&(b.needReadable||b.length<b.highWaterMark||0===b.length)}
P.prototype.setEncoding=function(a){this._readableState.decoder=new kd(a);this._readableState.encoding=a;return this};function td(a,b){if(0>=a||0===b.length&&b.ended)return 0;if(b.objectMode)return 1;if(a!==a)return b.flowing&&b.length?b.buffer.head.data.length:b.length;if(a>b.highWaterMark){var c=a;8388608<=c?c=8388608:(c--,c|=c>>>1,c|=c>>>2,c|=c>>>4,c|=c>>>8,c|=c>>>16,c++);b.highWaterMark=c;}return a<=b.length?a:b.ended?b.length:(b.needReadable=!0,0)}
P.prototype.read=function(a){Q("read",a);a=parseInt(a,10);var b=this._readableState,c=a;0!==a&&(b.emittedReadable=!1);if(0===a&&b.needReadable&&(b.length>=b.highWaterMark||b.ended))return Q("read: emitReadable",b.length,b.ended),0===b.length&&b.ended?Jd(this):rd(this),null;a=td(a,b);if(0===a&&b.ended)return 0===b.length&&Jd(this),null;var d=b.needReadable;Q("need readable",d);if(0===b.length||b.length-a<b.highWaterMark)d=!0,Q("length less than watermark",d);b.ended||b.reading?Q("reading or ended",
!1):d&&(Q("do read"),b.reading=!0,b.sync=!0,0===b.length&&(b.needReadable=!0),this._read(b.highWaterMark),b.sync=!1,b.reading||(a=td(c,b)));d=0<a?Kd(a,b):null;null===d?(b.needReadable=!0,a=0):b.length-=a;0===b.length&&(b.ended||(b.needReadable=!0),c!==a&&b.ended&&Jd(this));null!==d&&this.emit("data",d);return d};function rd(a){var b=a._readableState;b.needReadable=!1;b.emittedReadable||(Q("emitReadable",b.flowing),b.emittedReadable=!0,b.sync?G(Ld,a):Ld(a));}
function Ld(a){Q("emit readable");a.emit("readable");Md(a);}function sd(a,b){for(var c=b.length;!b.reading&&!b.flowing&&!b.ended&&b.length<b.highWaterMark&&(Q("maybeReadMore read 0"),a.read(0),c!==b.length);)c=b.length;b.readingMore=!1;}P.prototype._read=function(){this.emit("error",Error("not implemented"));};
P.prototype.pipe=function(a,b){function c(a){Q("onunpipe");a===n&&e();}function d(){Q("onend");a.end();}function e(){Q("cleanup");a.removeListener("close",h);a.removeListener("finish",k);a.removeListener("drain",B);a.removeListener("error",g);a.removeListener("unpipe",c);n.removeListener("end",d);n.removeListener("end",e);n.removeListener("data",f);m=!0;!q.awaitDrain||a._writableState&&!a._writableState.needDrain||B();}function f(b){Q("ondata");v=!1;!1!==a.write(b)||v||((1===q.pipesCount&&q.pipes===
a||1<q.pipesCount&&-1!==Nd(q.pipes,a))&&!m&&(Q("false write response, pause",n._readableState.awaitDrain),n._readableState.awaitDrain++,v=!0),n.pause());}function g(b){Q("onerror",b);p();a.removeListener("error",g);0===a.listeners("error").length&&a.emit("error",b);}function h(){a.removeListener("finish",k);p();}function k(){Q("onfinish");a.removeListener("close",h);p();}function p(){Q("unpipe");n.unpipe(a);}var n=this,q=this._readableState;switch(q.pipesCount){case 0:q.pipes=a;break;case 1:q.pipes=[q.pipes,
a];break;default:q.pipes.push(a);}q.pipesCount+=1;Q("pipe count=%d opts=%j",q.pipesCount,b);b=b&&!1===b.end?e:d;if(q.endEmitted)G(b);else n.once("end",b);a.on("unpipe",c);var B=Od(n);a.on("drain",B);var m=!1,v=!1;n.on("data",f);pd(a,"error",g);a.once("close",h);a.once("finish",k);a.emit("pipe",n);q.flowing||(Q("pipe resume"),n.resume());return a};
function Od(a){return function(){var b=a._readableState;Q("pipeOnDrain",b.awaitDrain);b.awaitDrain&&b.awaitDrain--;0===b.awaitDrain&&a.listeners("data").length&&(b.flowing=!0,Md(a));}}
P.prototype.unpipe=function(a){var b=this._readableState;if(0===b.pipesCount)return this;if(1===b.pipesCount){if(a&&a!==b.pipes)return this;a||(a=b.pipes);b.pipes=null;b.pipesCount=0;b.flowing=!1;a&&a.emit("unpipe",this);return this}if(!a){a=b.pipes;var c=b.pipesCount;b.pipes=null;b.pipesCount=0;b.flowing=!1;for(b=0;b<c;b++)a[b].emit("unpipe",this);return this}c=Nd(b.pipes,a);if(-1===c)return this;b.pipes.splice(c,1);--b.pipesCount;1===b.pipesCount&&(b.pipes=b.pipes[0]);a.emit("unpipe",this);return this};
P.prototype.on=function(a,b){b=O.prototype.on.call(this,a,b);"data"===a?!1!==this._readableState.flowing&&this.resume():"readable"===a&&(a=this._readableState,a.endEmitted||a.readableListening||(a.readableListening=a.needReadable=!0,a.emittedReadable=!1,a.reading?a.length&&rd(this):G(Pd,this)));return b};P.prototype.addListener=P.prototype.on;function Pd(a){Q("readable nexttick read 0");a.read(0);}
P.prototype.resume=function(){var a=this._readableState;a.flowing||(Q("resume"),a.flowing=!0,a.resumeScheduled||(a.resumeScheduled=!0,G(Qd,this,a)));return this};function Qd(a,b){b.reading||(Q("resume read 0"),a.read(0));b.resumeScheduled=!1;b.awaitDrain=0;a.emit("resume");Md(a);b.flowing&&!b.reading&&a.read(0);}P.prototype.pause=function(){Q("call pause flowing=%j",this._readableState.flowing);!1!==this._readableState.flowing&&(Q("pause"),this._readableState.flowing=!1,this.emit("pause"));return this};
function Md(a){var b=a._readableState;for(Q("flow",b.flowing);b.flowing&&null!==a.read(););}
P.prototype.wrap=function(a){var b=this._readableState,c=!1,d=this;a.on("end",function(){Q("wrapped end");if(b.decoder&&!b.ended){var a=b.decoder.end();a&&a.length&&d.push(a);}d.push(null);});a.on("data",function(e){Q("wrapped data");b.decoder&&(e=b.decoder.write(e));b.objectMode&&(null===e||void 0===e)||!(b.objectMode||e&&e.length)||d.push(e)||(c=!0,a.pause());});for(var e in a)void 0===this[e]&&"function"===typeof a[e]&&(this[e]=function(b){return function(){return a[b].apply(a,arguments)}}(e));Rd(["error",
"close","destroy","pause","resume"],function(b){a.on(b,d.emit.bind(d,b));});d._read=function(b){Q("wrapped _read",b);c&&(c=!1,a.resume());};return d};P._fromList=Kd;
function Kd(a,b){if(0===b.length)return null;if(b.objectMode)var c=b.buffer.shift();else if(!a||a>=b.length)c=b.decoder?b.buffer.join(""):1===b.buffer.length?b.buffer.head.data:b.buffer.concat(b.length),b.buffer.clear();else {c=b.buffer;b=b.decoder;if(a<c.head.data.length)b=c.head.data.slice(0,a),c.head.data=c.head.data.slice(a);else {if(a===c.head.data.length)c=c.shift();else if(b){b=c.head;var d=1,e=b.data;for(a-=e.length;b=b.next;){var f=b.data,g=a>f.length?f.length:a;e=g===f.length?e+f:e+f.slice(0,
a);a-=g;if(0===a){g===f.length?(++d,c.head=b.next?b.next:c.tail=null):(c.head=b,b.data=f.slice(g));break}++d;}c.length-=d;c=e;}else {b=z.allocUnsafe(a);d=c.head;e=1;d.data.copy(b);for(a-=d.data.length;d=d.next;){f=d.data;g=a>f.length?f.length:a;f.copy(b,b.length-a,0,g);a-=g;if(0===a){g===f.length?(++e,c.head=d.next?d.next:c.tail=null):(c.head=d,d.data=f.slice(g));break}++e;}c.length-=e;c=b;}b=c;}c=b;}return c}
function Jd(a){var b=a._readableState;if(0<b.length)throw Error('"endReadable()" called on non-empty stream');b.endEmitted||(b.ended=!0,G(Sd,b,a));}function Sd(a,b){a.endEmitted||0!==a.length||(a.endEmitted=!0,b.readable=!1,b.emit("end"));}function Rd(a,b){for(var c=0,d=a.length;c<d;c++)b(a[c],c);}function Nd(a,b){for(var c=0,d=a.length;c<d;c++)if(a[c]===b)return c;return -1}W.WritableState=Td;Db(W,O);function Ud(){}function Vd(a,b,c){this.chunk=a;this.encoding=b;this.callback=c;this.next=null;}
function Td(a,b){Object.defineProperty(this,"buffer",{get:Ib(function(){return this.getBuffer()},"_writableState.buffer is deprecated. Use _writableState.getBuffer instead.")});a=a||{};this.objectMode=!!a.objectMode;b instanceof V&&(this.objectMode=this.objectMode||!!a.writableObjectMode);var c=a.highWaterMark,d=this.objectMode?16:16384;this.highWaterMark=c||0===c?c:d;this.highWaterMark=~~this.highWaterMark;this.finished=this.ended=this.ending=this.needDrain=!1;this.decodeStrings=!1!==a.decodeStrings;
this.defaultEncoding=a.defaultEncoding||"utf8";this.length=0;this.writing=!1;this.corked=0;this.sync=!0;this.bufferProcessing=!1;this.onwrite=function(a){var c=b._writableState,d=c.sync,e=c.writecb;c.writing=!1;c.writecb=null;c.length-=c.writelen;c.writelen=0;a?(--c.pendingcb,d?G(e,a):e(a),b._writableState.errorEmitted=!0,b.emit("error",a)):((a=Wd(c))||c.corked||c.bufferProcessing||!c.bufferedRequest||Xd(b,c),d?G(Yd,b,c,a,e):Yd(b,c,a,e));};this.writecb=null;this.writelen=0;this.lastBufferedRequest=
this.bufferedRequest=null;this.pendingcb=0;this.errorEmitted=this.prefinished=!1;this.bufferedRequestCount=0;this.corkedRequestsFree=new Zd(this);}Td.prototype.getBuffer=function(){for(var a=this.bufferedRequest,b=[];a;)b.push(a),a=a.next;return b};function W(a){if(!(this instanceof W||this instanceof V))return new W(a);this._writableState=new Td(a,this);this.writable=!0;a&&("function"===typeof a.write&&(this._write=a.write),"function"===typeof a.writev&&(this._writev=a.writev));O.call(this);}
W.prototype.pipe=function(){this.emit("error",Error("Cannot pipe, not readable"));};
W.prototype.write=function(a,b,c){var d=this._writableState,e=!1;"function"===typeof b&&(c=b,b=null);z.isBuffer(a)?b="buffer":b||(b=d.defaultEncoding);"function"!==typeof c&&(c=Ud);if(d.ended)d=c,a=Error("write after end"),this.emit("error",a),G(d,a);else {var f=c,g=!0,h=!1;null===a?h=new TypeError("May not write null values to stream"):z.isBuffer(a)||"string"===typeof a||void 0===a||d.objectMode||(h=new TypeError("Invalid non-string/buffer chunk"));h&&(this.emit("error",h),G(f,h),g=!1);g&&(d.pendingcb++,
e=b,d.objectMode||!1===d.decodeStrings||"string"!==typeof a||(a=z.from(a,e)),z.isBuffer(a)&&(e="buffer"),f=d.objectMode?1:a.length,d.length+=f,b=d.length<d.highWaterMark,b||(d.needDrain=!0),d.writing||d.corked?(f=d.lastBufferedRequest,d.lastBufferedRequest=new Vd(a,e,c),f?f.next=d.lastBufferedRequest:d.bufferedRequest=d.lastBufferedRequest,d.bufferedRequestCount+=1):$d(this,d,!1,f,a,e,c),e=b);}return e};W.prototype.cork=function(){this._writableState.corked++;};
W.prototype.uncork=function(){var a=this._writableState;a.corked&&(a.corked--,a.writing||a.corked||a.finished||a.bufferProcessing||!a.bufferedRequest||Xd(this,a));};W.prototype.setDefaultEncoding=function(a){"string"===typeof a&&(a=a.toLowerCase());if(!(-1<"hex utf8 utf-8 ascii binary base64 ucs2 ucs-2 utf16le utf-16le raw".split(" ").indexOf((a+"").toLowerCase())))throw new TypeError("Unknown encoding: "+a);this._writableState.defaultEncoding=a;return this};
function $d(a,b,c,d,e,f,g){b.writelen=d;b.writecb=g;b.writing=!0;b.sync=!0;c?a._writev(e,b.onwrite):a._write(e,f,b.onwrite);b.sync=!1;}function Yd(a,b,c,d){!c&&0===b.length&&b.needDrain&&(b.needDrain=!1,a.emit("drain"));b.pendingcb--;d();ae(a,b);}
function Xd(a,b){b.bufferProcessing=!0;var c=b.bufferedRequest;if(a._writev&&c&&c.next){var d=Array(b.bufferedRequestCount),e=b.corkedRequestsFree;e.entry=c;for(var f=0;c;)d[f]=c,c=c.next,f+=1;$d(a,b,!0,b.length,d,"",e.finish);b.pendingcb++;b.lastBufferedRequest=null;e.next?(b.corkedRequestsFree=e.next,e.next=null):b.corkedRequestsFree=new Zd(b);}else {for(;c&&(d=c.chunk,$d(a,b,!1,b.objectMode?1:d.length,d,c.encoding,c.callback),c=c.next,!b.writing););null===c&&(b.lastBufferedRequest=null);}b.bufferedRequestCount=
0;b.bufferedRequest=c;b.bufferProcessing=!1;}W.prototype._write=function(a,b,c){c(Error("not implemented"));};W.prototype._writev=null;W.prototype.end=function(a,b,c){var d=this._writableState;"function"===typeof a?(c=a,b=a=null):"function"===typeof b&&(c=b,b=null);null!==a&&void 0!==a&&this.write(a,b);d.corked&&(d.corked=1,this.uncork());if(!d.ending&&!d.finished){a=c;d.ending=!0;ae(this,d);if(a)if(d.finished)G(a);else this.once("finish",a);d.ended=!0;this.writable=!1;}};
function Wd(a){return a.ending&&0===a.length&&null===a.bufferedRequest&&!a.finished&&!a.writing}function ae(a,b){var c=Wd(b);c&&(0===b.pendingcb?(b.prefinished||(b.prefinished=!0,a.emit("prefinish")),b.finished=!0,a.emit("finish")):b.prefinished||(b.prefinished=!0,a.emit("prefinish")));return c}
function Zd(a){var b=this;this.entry=this.next=null;this.finish=function(c){var d=b.entry;for(b.entry=null;d;){var e=d.callback;a.pendingcb--;e(c);d=d.next;}a.corkedRequestsFree?a.corkedRequestsFree.next=b:a.corkedRequestsFree=b;};}Db(V,P);for(var be=Object.keys(W.prototype),ce=0;ce<be.length;ce++){var de=be[ce];V.prototype[de]||(V.prototype[de]=W.prototype[de]);}
function V(a){if(!(this instanceof V))return new V(a);P.call(this,a);W.call(this,a);a&&!1===a.readable&&(this.readable=!1);a&&!1===a.writable&&(this.writable=!1);this.allowHalfOpen=!0;a&&!1===a.allowHalfOpen&&(this.allowHalfOpen=!1);this.once("end",ee);}function ee(){this.allowHalfOpen||this._writableState.ended||G(fe,this);}function fe(a){a.end();}Db(X,V);
function ge(a){this.afterTransform=function(b,c){var d=a._transformState;d.transforming=!1;var e=d.writecb;e?(d.writechunk=null,d.writecb=null,null!==c&&void 0!==c&&a.push(c),e(b),b=a._readableState,b.reading=!1,(b.needReadable||b.length<b.highWaterMark)&&a._read(b.highWaterMark),b=void 0):b=a.emit("error",Error("no writecb in Transform class"));return b};this.transforming=this.needTransform=!1;this.writeencoding=this.writechunk=this.writecb=null;}
function X(a){if(!(this instanceof X))return new X(a);V.call(this,a);this._transformState=new ge(this);var b=this;this._readableState.needReadable=!0;this._readableState.sync=!1;a&&("function"===typeof a.transform&&(this._transform=a.transform),"function"===typeof a.flush&&(this._flush=a.flush));this.once("prefinish",function(){"function"===typeof this._flush?this._flush(function(a){he(b,a);}):he(b);});}
X.prototype.push=function(a,b){this._transformState.needTransform=!1;return V.prototype.push.call(this,a,b)};X.prototype._transform=function(){throw Error("Not implemented");};X.prototype._write=function(a,b,c){var d=this._transformState;d.writecb=c;d.writechunk=a;d.writeencoding=b;d.transforming||(a=this._readableState,(d.needTransform||a.needReadable||a.length<a.highWaterMark)&&this._read(a.highWaterMark));};
X.prototype._read=function(){var a=this._transformState;null!==a.writechunk&&a.writecb&&!a.transforming?(a.transforming=!0,this._transform(a.writechunk,a.writeencoding,a.afterTransform)):a.needTransform=!0;};function he(a,b){if(b)return a.emit("error",b);b=a._transformState;if(a._writableState.length)throw Error("Calling transform done when ws.length != 0");if(b.transforming)throw Error("Calling transform done when still transforming");return a.push(null)}Db(ie,X);
function ie(a){if(!(this instanceof ie))return new ie(a);X.call(this,a);}ie.prototype._transform=function(a,b,c){c(null,a);};Db(Y,O);Y.Readable=P;Y.Writable=W;Y.Duplex=V;Y.Transform=X;Y.PassThrough=ie;Y.Stream=Y;function Y(){O.call(this);}
Y.prototype.pipe=function(a,b){function c(b){a.writable&&!1===a.write(b)&&k.pause&&k.pause();}function d(){k.readable&&k.resume&&k.resume();}function e(){p||(p=!0,a.end());}function f(){p||(p=!0,"function"===typeof a.destroy&&a.destroy());}function g(a){h();if(0===O.listenerCount(this,"error"))throw a;}function h(){k.removeListener("data",c);a.removeListener("drain",d);k.removeListener("end",e);k.removeListener("close",f);k.removeListener("error",g);a.removeListener("error",g);k.removeListener("end",
h);k.removeListener("close",h);a.removeListener("close",h);}var k=this;k.on("data",c);a.on("drain",d);a._isStdio||b&&!1===b.end||(k.on("end",e),k.on("close",f));var p=!1;k.on("error",g);a.on("error",g);k.on("end",h);k.on("close",h);a.on("close",h);a.emit("pipe",k);return a};
var je=Array.prototype.slice,le={extend:function ke(a,b){for(var d in b)a[d]=b[d];return 3>arguments.length?a:ke.apply(null,[a].concat(je.call(arguments,2)))}},me=u(function(a,b){function c(a,b,c){void 0===c&&(c=function(a){return a});return function(){for(var e=[],f=0;f<arguments.length;f++)e[f]=arguments[f];return new Promise(function(f,g){a[b].bind(a).apply(void 0,d(e,[function(a,b){return a?g(a):f(c(b))}]));})}}var d=l&&l.__spreadArrays||function(){for(var a=0,b=0,c=arguments.length;b<c;b++)a+=
arguments[b].length;a=Array(a);var d=0;for(b=0;b<c;b++)for(var e=arguments[b],n=0,q=e.length;n<q;n++,d++)a[d]=e[n];return a};Object.defineProperty(b,"__esModule",{value:!0});var e=function(){function a(a,b){this.vol=a;this.fd=b;}a.prototype.appendFile=function(a,b){return c(this.vol,"appendFile")(this.fd,a,b)};a.prototype.chmod=function(a){return c(this.vol,"fchmod")(this.fd,a)};a.prototype.chown=function(a,b){return c(this.vol,"fchown")(this.fd,a,b)};a.prototype.close=function(){return c(this.vol,
"close")(this.fd)};a.prototype.datasync=function(){return c(this.vol,"fdatasync")(this.fd)};a.prototype.read=function(a,b,d,e){return c(this.vol,"read",function(b){return {bytesRead:b,buffer:a}})(this.fd,a,b,d,e)};a.prototype.readFile=function(a){return c(this.vol,"readFile")(this.fd,a)};a.prototype.stat=function(a){return c(this.vol,"fstat")(this.fd,a)};a.prototype.sync=function(){return c(this.vol,"fsync")(this.fd)};a.prototype.truncate=function(a){return c(this.vol,"ftruncate")(this.fd,a)};a.prototype.utimes=
function(a,b){return c(this.vol,"futimes")(this.fd,a,b)};a.prototype.write=function(a,b,d,e){return c(this.vol,"write",function(b){return {bytesWritten:b,buffer:a}})(this.fd,a,b,d,e)};a.prototype.writeFile=function(a,b){return c(this.vol,"writeFile")(this.fd,a,b)};return a}();b.FileHandle=e;b.default=function(a){return "undefined"===typeof Promise?null:{FileHandle:e,access:function(b,d){return c(a,"access")(b,d)},appendFile:function(b,d,f){return c(a,"appendFile")(b instanceof e?b.fd:b,d,f)},chmod:function(b,
d){return c(a,"chmod")(b,d)},chown:function(b,d,e){return c(a,"chown")(b,d,e)},copyFile:function(b,d,e){return c(a,"copyFile")(b,d,e)},lchmod:function(b,d){return c(a,"lchmod")(b,d)},lchown:function(b,d,e){return c(a,"lchown")(b,d,e)},link:function(b,d){return c(a,"link")(b,d)},lstat:function(b,d){return c(a,"lstat")(b,d)},mkdir:function(b,d){return c(a,"mkdir")(b,d)},mkdtemp:function(b,d){return c(a,"mkdtemp")(b,d)},open:function(b,d,f){return c(a,"open",function(b){return new e(a,b)})(b,d,f)},readdir:function(b,
d){return c(a,"readdir")(b,d)},readFile:function(b,d){return c(a,"readFile")(b instanceof e?b.fd:b,d)},readlink:function(b,d){return c(a,"readlink")(b,d)},realpath:function(b,d){return c(a,"realpath")(b,d)},rename:function(b,d){return c(a,"rename")(b,d)},rmdir:function(b){return c(a,"rmdir")(b)},stat:function(b,d){return c(a,"stat")(b,d)},symlink:function(b,d,e){return c(a,"symlink")(b,d,e)},truncate:function(b,d){return c(a,"truncate")(b,d)},unlink:function(b){return c(a,"unlink")(b)},utimes:function(b,
d,e){return c(a,"utimes")(b,d,e)},writeFile:function(b,d,f){return c(a,"writeFile")(b instanceof e?b.fd:b,d,f)}}};});t(me);var ne=/[^\x20-\x7E]/,oe=/[\x2E\u3002\uFF0E\uFF61]/g,pe={overflow:"Overflow: input needs wider integers to process","not-basic":"Illegal input >= 0x80 (not a basic code point)","invalid-input":"Invalid input"},qe=Math.floor,re=String.fromCharCode;
function se(a,b){var c=a.split("@"),d="";1<c.length&&(d=c[0]+"@",a=c[1]);a=a.replace(oe,".");a=a.split(".");c=a.length;for(var e=[];c--;)e[c]=b(a[c]);b=e.join(".");return d+b}function te(a,b){return a+22+75*(26>a)-((0!=b)<<5)}
function ue(a){return se(a,function(a){if(ne.test(a)){var b;var d=[];var e=[];var f=0;for(b=a.length;f<b;){var g=a.charCodeAt(f++);if(55296<=g&&56319>=g&&f<b){var h=a.charCodeAt(f++);56320==(h&64512)?e.push(((g&1023)<<10)+(h&1023)+65536):(e.push(g),f--);}else e.push(g);}a=e;h=a.length;e=128;var k=0;var p=72;for(g=0;g<h;++g){var n=a[g];128>n&&d.push(re(n));}for((f=b=d.length)&&d.push("-");f<h;){var q=2147483647;for(g=0;g<h;++g)n=a[g],n>=e&&n<q&&(q=n);var B=f+1;if(q-e>qe((2147483647-k)/B))throw new RangeError(pe.overflow);
k+=(q-e)*B;e=q;for(g=0;g<h;++g){n=a[g];if(n<e&&2147483647<++k)throw new RangeError(pe.overflow);if(n==e){var m=k;for(q=36;;q+=36){n=q<=p?1:q>=p+26?26:q-p;if(m<n)break;var v=m-n;m=36-n;d.push(re(te(n+v%m,0)));m=qe(v/m);}d.push(re(te(m,0)));p=B;q=0;k=f==b?qe(k/700):k>>1;for(k+=qe(k/p);455<k;q+=36)k=qe(k/35);p=qe(q+36*k/(k+38));k=0;++f;}}++k;++e;}d="xn--"+d.join("");}else d=a;return d})}var ve=Array.isArray||function(a){return "[object Array]"===Object.prototype.toString.call(a)};
function we(a){switch(typeof a){case "string":return a;case "boolean":return a?"true":"false";case "number":return isFinite(a)?a:"";default:return ""}}function xe(a,b,c,d){b=b||"&";c=c||"=";null===a&&(a=void 0);return "object"===typeof a?ye(ze(a),function(d){var e=encodeURIComponent(we(d))+c;return ve(a[d])?ye(a[d],function(a){return e+encodeURIComponent(we(a))}).join(b):e+encodeURIComponent(we(a[d]))}).join(b):d?encodeURIComponent(we(d))+c+encodeURIComponent(we(a)):""}
function ye(a,b){if(a.map)return a.map(b);for(var c=[],d=0;d<a.length;d++)c.push(b(a[d],d));return c}var ze=Object.keys||function(a){var b=[],c;for(c in a)Object.prototype.hasOwnProperty.call(a,c)&&b.push(c);return b};
function Ae(a,b,c,d){c=c||"=";var e={};if("string"!==typeof a||0===a.length)return e;var f=/\+/g;a=a.split(b||"&");b=1E3;d&&"number"===typeof d.maxKeys&&(b=d.maxKeys);d=a.length;0<b&&d>b&&(d=b);for(b=0;b<d;++b){var g=a[b].replace(f,"%20"),h=g.indexOf(c);if(0<=h){var k=g.substr(0,h);g=g.substr(h+1);}else k=g,g="";k=decodeURIComponent(k);g=decodeURIComponent(g);Object.prototype.hasOwnProperty.call(e,k)?ve(e[k])?e[k].push(g):e[k]=[e[k],g]:e[k]=g;}return e}
var Fe={parse:Be,resolve:Ce,resolveObject:De,format:Ee,Url:Z};function Z(){this.href=this.path=this.pathname=this.query=this.search=this.hash=this.hostname=this.port=this.host=this.auth=this.slashes=this.protocol=null;}
var Ge=/^([a-z0-9.+-]+:)/i,He=/:[0-9]*$/,Ie=/^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,Je="{}|\\^`".split("").concat('<>"` \r\n\t'.split("")),Ke=["'"].concat(Je),Le=["%","/","?",";","#"].concat(Ke),Me=["/","?","#"],Ne=255,Oe=/^[+a-z0-9A-Z_-]{0,63}$/,Pe=/^([+a-z0-9A-Z_-]{0,63})(.*)$/,Qe={javascript:!0,"javascript:":!0},Re={javascript:!0,"javascript:":!0},Se={http:!0,https:!0,ftp:!0,gopher:!0,file:!0,"http:":!0,"https:":!0,"ftp:":!0,"gopher:":!0,"file:":!0};
function Be(a,b,c){if(a&&Hb(a)&&a instanceof Z)return a;var d=new Z;d.parse(a,b,c);return d}Z.prototype.parse=function(a,b,c){return Te(this,a,b,c)};
function Te(a,b,c,d){if(!Gb(b))throw new TypeError("Parameter 'url' must be a string, not "+typeof b);var e=b.indexOf("?");e=-1!==e&&e<b.indexOf("#")?"?":"#";b=b.split(e);b[0]=b[0].replace(/\\/g,"/");b=b.join(e);e=b.trim();if(!d&&1===b.split("#").length&&(b=Ie.exec(e)))return a.path=e,a.href=e,a.pathname=b[1],b[2]?(a.search=b[2],a.query=c?Ae(a.search.substr(1)):a.search.substr(1)):c&&(a.search="",a.query={}),a;if(b=Ge.exec(e)){b=b[0];var f=b.toLowerCase();a.protocol=f;e=e.substr(b.length);}if(d||b||
e.match(/^\/\/[^@\/]+@[^@\/]+/)){var g="//"===e.substr(0,2);!g||b&&Re[b]||(e=e.substr(2),a.slashes=!0);}if(!Re[b]&&(g||b&&!Se[b])){b=-1;for(d=0;d<Me.length;d++)g=e.indexOf(Me[d]),-1!==g&&(-1===b||g<b)&&(b=g);g=-1===b?e.lastIndexOf("@"):e.lastIndexOf("@",b);-1!==g&&(d=e.slice(0,g),e=e.slice(g+1),a.auth=decodeURIComponent(d));b=-1;for(d=0;d<Le.length;d++)g=e.indexOf(Le[d]),-1!==g&&(-1===b||g<b)&&(b=g);-1===b&&(b=e.length);a.host=e.slice(0,b);e=e.slice(b);Ue(a);a.hostname=a.hostname||"";g="["===a.hostname[0]&&
"]"===a.hostname[a.hostname.length-1];if(!g){var h=a.hostname.split(/\./);d=0;for(b=h.length;d<b;d++){var k=h[d];if(k&&!k.match(Oe)){for(var p="",n=0,q=k.length;n<q;n++)p=127<k.charCodeAt(n)?p+"x":p+k[n];if(!p.match(Oe)){b=h.slice(0,d);d=h.slice(d+1);if(k=k.match(Pe))b.push(k[1]),d.unshift(k[2]);d.length&&(e="/"+d.join(".")+e);a.hostname=b.join(".");break}}}}a.hostname=a.hostname.length>Ne?"":a.hostname.toLowerCase();g||(a.hostname=ue(a.hostname));d=a.port?":"+a.port:"";a.host=(a.hostname||"")+d;
a.href+=a.host;g&&(a.hostname=a.hostname.substr(1,a.hostname.length-2),"/"!==e[0]&&(e="/"+e));}if(!Qe[f])for(d=0,b=Ke.length;d<b;d++)g=Ke[d],-1!==e.indexOf(g)&&(k=encodeURIComponent(g),k===g&&(k=escape(g)),e=e.split(g).join(k));d=e.indexOf("#");-1!==d&&(a.hash=e.substr(d),e=e.slice(0,d));d=e.indexOf("?");-1!==d?(a.search=e.substr(d),a.query=e.substr(d+1),c&&(a.query=Ae(a.query)),e=e.slice(0,d)):c&&(a.search="",a.query={});e&&(a.pathname=e);Se[f]&&a.hostname&&!a.pathname&&(a.pathname="/");if(a.pathname||
a.search)d=a.pathname||"",a.path=d+(a.search||"");a.href=Ve(a);return a}function Ee(a){Gb(a)&&(a=Te({},a));return Ve(a)}
function Ve(a){var b=a.auth||"";b&&(b=encodeURIComponent(b),b=b.replace(/%3A/i,":"),b+="@");var c=a.protocol||"",d=a.pathname||"",e=a.hash||"",f=!1,g="";a.host?f=b+a.host:a.hostname&&(f=b+(-1===a.hostname.indexOf(":")?a.hostname:"["+this.hostname+"]"),a.port&&(f+=":"+a.port));a.query&&Hb(a.query)&&Object.keys(a.query).length&&(g=xe(a.query));b=a.search||g&&"?"+g||"";c&&":"!==c.substr(-1)&&(c+=":");a.slashes||(!c||Se[c])&&!1!==f?(f="//"+(f||""),d&&"/"!==d.charAt(0)&&(d="/"+d)):f||(f="");e&&"#"!==e.charAt(0)&&
(e="#"+e);b&&"?"!==b.charAt(0)&&(b="?"+b);d=d.replace(/[?#]/g,function(a){return encodeURIComponent(a)});b=b.replace("#","%23");return c+f+d+b+e}Z.prototype.format=function(){return Ve(this)};function Ce(a,b){return Be(a,!1,!0).resolve(b)}Z.prototype.resolve=function(a){return this.resolveObject(Be(a,!1,!0)).format()};function De(a,b){return a?Be(a,!1,!0).resolveObject(b):b}
Z.prototype.resolveObject=function(a){if(Gb(a)){var b=new Z;b.parse(a,!1,!0);a=b;}b=new Z;for(var c=Object.keys(this),d=0;d<c.length;d++){var e=c[d];b[e]=this[e];}b.hash=a.hash;if(""===a.href)return b.href=b.format(),b;if(a.slashes&&!a.protocol){c=Object.keys(a);for(d=0;d<c.length;d++)e=c[d],"protocol"!==e&&(b[e]=a[e]);Se[b.protocol]&&b.hostname&&!b.pathname&&(b.path=b.pathname="/");b.href=b.format();return b}var f;if(a.protocol&&a.protocol!==b.protocol){if(!Se[a.protocol]){c=Object.keys(a);for(d=0;d<
c.length;d++)e=c[d],b[e]=a[e];b.href=b.format();return b}b.protocol=a.protocol;if(a.host||Re[a.protocol])b.pathname=a.pathname;else {for(f=(a.pathname||"").split("/");f.length&&!(a.host=f.shift()););a.host||(a.host="");a.hostname||(a.hostname="");""!==f[0]&&f.unshift("");2>f.length&&f.unshift("");b.pathname=f.join("/");}b.search=a.search;b.query=a.query;b.host=a.host||"";b.auth=a.auth;b.hostname=a.hostname||a.host;b.port=a.port;if(b.pathname||b.search)b.path=(b.pathname||"")+(b.search||"");b.slashes=
b.slashes||a.slashes;b.href=b.format();return b}c=b.pathname&&"/"===b.pathname.charAt(0);var g=a.host||a.pathname&&"/"===a.pathname.charAt(0),h=c=g||c||b.host&&a.pathname;d=b.pathname&&b.pathname.split("/")||[];e=b.protocol&&!Se[b.protocol];f=a.pathname&&a.pathname.split("/")||[];e&&(b.hostname="",b.port=null,b.host&&(""===d[0]?d[0]=b.host:d.unshift(b.host)),b.host="",a.protocol&&(a.hostname=null,a.port=null,a.host&&(""===f[0]?f[0]=a.host:f.unshift(a.host)),a.host=null),c=c&&(""===f[0]||""===d[0]));
if(g)b.host=a.host||""===a.host?a.host:b.host,b.hostname=a.hostname||""===a.hostname?a.hostname:b.hostname,b.search=a.search,b.query=a.query,d=f;else if(f.length)d||(d=[]),d.pop(),d=d.concat(f),b.search=a.search,b.query=a.query;else if(null!=a.search){e&&(b.hostname=b.host=d.shift(),e=b.host&&0<b.host.indexOf("@")?b.host.split("@"):!1)&&(b.auth=e.shift(),b.host=b.hostname=e.shift());b.search=a.search;b.query=a.query;if(null!==b.pathname||null!==b.search)b.path=(b.pathname?b.pathname:"")+(b.search?
b.search:"");b.href=b.format();return b}if(!d.length)return b.pathname=null,b.path=b.search?"/"+b.search:null,b.href=b.format(),b;g=d.slice(-1)[0];f=(b.host||a.host||1<d.length)&&("."===g||".."===g)||""===g;for(var k=0,p=d.length;0<=p;p--)g=d[p],"."===g?d.splice(p,1):".."===g?(d.splice(p,1),k++):k&&(d.splice(p,1),k--);if(!c&&!h)for(;k--;k)d.unshift("..");!c||""===d[0]||d[0]&&"/"===d[0].charAt(0)||d.unshift("");f&&"/"!==d.join("/").substr(-1)&&d.push("");h=""===d[0]||d[0]&&"/"===d[0].charAt(0);e&&
(b.hostname=b.host=h?"":d.length?d.shift():"",e=b.host&&0<b.host.indexOf("@")?b.host.split("@"):!1)&&(b.auth=e.shift(),b.host=b.hostname=e.shift());(c=c||b.host&&d.length)&&!h&&d.unshift("");d.length?b.pathname=d.join("/"):(b.pathname=null,b.path=null);if(null!==b.pathname||null!==b.search)b.path=(b.pathname?b.pathname:"")+(b.search?b.search:"");b.auth=a.auth||b.auth;b.slashes=b.slashes||a.slashes;b.href=b.format();return b};Z.prototype.parseHost=function(){return Ue(this)};
function Ue(a){var b=a.host,c=He.exec(b);c&&(c=c[0],":"!==c&&(a.port=c.substr(1)),b=b.substr(0,b.length-c.length));b&&(a.hostname=b);}
var We=u(function(a,b){function c(a,b){a=a[b];return 0<b&&("/"===a||e&&"\\"===a)}function d(a){var b=1<arguments.length&&void 0!==arguments[1]?arguments[1]:!0;if(e){var d=a;if("string"!==typeof d)throw new TypeError("expected a string");d=d.replace(/[\\\/]+/g,"/");if(!1!==b)if(b=d,d=b.length-1,2>d)d=b;else {for(;c(b,d);)d--;d=b.substr(0,d+1);}return d.replace(/^([a-zA-Z]+:|\.\/)/,"")}return a}Object.defineProperty(b,"__esModule",{value:!0});b.unixify=d;b.correctPath=function(a){return d(a.replace(/^\\\\\?\\.:\\/,
"\\"))};var e="win32"===Cb.platform;});t(We);
var Xe=u(function(a,b){function c(a,b){void 0===b&&(b=L.default.cwd());return cf(b,a)}function d(a,b){return "function"===typeof a?[e(),a]:[e(a),q(b)]}function e(a){void 0===a&&(a={});return aa({},df,a)}function f(a){return "number"===typeof a?aa({},ud,{mode:a}):aa({},ud,a)}function g(a,b,c,d){void 0===b&&(b="");void 0===c&&(c="");void 0===d&&(d="");var e="";c&&(e=" '"+c+"'");d&&(e+=" -> '"+d+"'");switch(a){case "ENOENT":return "ENOENT: no such file or directory, "+b+e;case "EBADF":return "EBADF: bad file descriptor, "+
b+e;case "EINVAL":return "EINVAL: invalid argument, "+b+e;case "EPERM":return "EPERM: operation not permitted, "+b+e;case "EPROTO":return "EPROTO: protocol error, "+b+e;case "EEXIST":return "EEXIST: file already exists, "+b+e;case "ENOTDIR":return "ENOTDIR: not a directory, "+b+e;case "EISDIR":return "EISDIR: illegal operation on a directory, "+b+e;case "EACCES":return "EACCES: permission denied, "+b+e;case "ENOTEMPTY":return "ENOTEMPTY: directory not empty, "+b+e;case "EMFILE":return "EMFILE: too many open files, "+
b+e;case "ENOSYS":return "ENOSYS: function not implemented, "+b+e;default:return a+": error occurred, "+b+e}}function h(a,b,c,d,e){void 0===b&&(b="");void 0===c&&(c="");void 0===d&&(d="");void 0===e&&(e=Error);b=new e(g(a,b,c,d));b.code=a;return b}function k(a){if("number"===typeof a)return a;if("string"===typeof a){var b=ua[a];if("undefined"!==typeof b)return b}throw new Pc.TypeError("ERR_INVALID_OPT_VALUE","flags",a);}function p(a,b){if(b){var c=typeof b;switch(c){case "string":a=aa({},a,{encoding:b});
break;case "object":a=aa({},a,b);break;default:throw TypeError("Expected options to be either an object or a string, but got "+c+" instead");}}else return a;"buffer"!==a.encoding&&K.assertEncoding(a.encoding);return a}function n(a){return function(b){return p(a,b)}}function q(a){if("function"!==typeof a)throw TypeError(fa.CB);return a}function B(a){return function(b,c){return "function"===typeof b?[a(),b]:[a(b),q(c)]}}function m(a){if("string"!==typeof a&&!F.Buffer.isBuffer(a)){try{if(!(a instanceof
Fe.URL))throw new TypeError(fa.PATH_STR);}catch(Xa){throw new TypeError(fa.PATH_STR);}if(""!==a.hostname)throw new Pc.TypeError("ERR_INVALID_FILE_URL_HOST",L.default.platform);a=a.pathname;for(var b=0;b<a.length;b++)if("%"===a[b]){var c=a.codePointAt(b+2)|32;if("2"===a[b+1]&&102===c)throw new Pc.TypeError("ERR_INVALID_FILE_URL_PATH","must not include encoded / characters");}a=decodeURIComponent(a);}a=String(a);qb(a);return a}function v(a,b){return (a=c(a,b).substr(1))?a.split(S):[]}function xa(a){return v(m(a))}
function La(a,b){void 0===b&&(b=K.ENCODING_UTF8);return F.Buffer.isBuffer(a)?a:a instanceof Uint8Array?F.bufferFrom(a):F.bufferFrom(String(a),b)}function $b(a,b){return b&&"buffer"!==b?a.toString(b):a}function qb(a,b){if(-1!==(""+a).indexOf("\x00")){a=Error("Path must be a string without null bytes");a.code="ENOENT";if("function"!==typeof b)throw a;L.default.nextTick(b,a);return !1}return !0}function M(a,b){a="number"===typeof a?a:"string"===typeof a?parseInt(a,8):b?M(b):void 0;if("number"!==typeof a||
isNaN(a))throw new TypeError(fa.MODE_INT);return a}function Ya(a){if(a>>>0!==a)throw TypeError(fa.FD);}function ha(a){if("string"===typeof a&&+a==a)return +a;if(a instanceof Date)return a.getTime()/1E3;if(isFinite(a))return 0>a?Date.now()/1E3:a;throw Error("Cannot parse time: "+a);}function Ha(a){if("number"!==typeof a)throw TypeError(fa.UID);}function Ia(a){if("number"!==typeof a)throw TypeError(fa.GID);}function ef(a){a.emit("stop");}function T(a,b,c){if(!(this instanceof T))return new T(a,b,c);this._vol=
a;c=aa({},p(c,{}));void 0===c.highWaterMark&&(c.highWaterMark=65536);Y.Readable.call(this,c);this.path=m(b);this.fd=void 0===c.fd?null:c.fd;this.flags=void 0===c.flags?"r":c.flags;this.mode=void 0===c.mode?438:c.mode;this.start=c.start;this.end=c.end;this.autoClose=void 0===c.autoClose?!0:c.autoClose;this.pos=void 0;this.bytesRead=0;if(void 0!==this.start){if("number"!==typeof this.start)throw new TypeError('"start" option must be a Number');if(void 0===this.end)this.end=Infinity;else if("number"!==
typeof this.end)throw new TypeError('"end" option must be a Number');if(this.start>this.end)throw Error('"start" option must be <= "end" option');this.pos=this.start;}"number"!==typeof this.fd&&this.open();this.on("end",function(){this.autoClose&&this.destroy&&this.destroy();});}function ff(){this.close();}function R(a,b,c){if(!(this instanceof R))return new R(a,b,c);this._vol=a;c=aa({},p(c,{}));Y.Writable.call(this,c);this.path=m(b);this.fd=void 0===c.fd?null:c.fd;this.flags=void 0===c.flags?"w":c.flags;
this.mode=void 0===c.mode?438:c.mode;this.start=c.start;this.autoClose=void 0===c.autoClose?!0:!!c.autoClose;this.pos=void 0;this.bytesWritten=0;if(void 0!==this.start){if("number"!==typeof this.start)throw new TypeError('"start" option must be a Number');if(0>this.start)throw Error('"start" must be >= zero');this.pos=this.start;}c.encoding&&this.setDefaultEncoding(c.encoding);"number"!==typeof this.fd&&this.open();this.once("finish",function(){this.autoClose&&this.close();});}var Ja=l&&l.__extends||
function(){function a(b,c){a=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(a,b){a.__proto__=b;}||function(a,b){for(var c in b)b.hasOwnProperty(c)&&(a[c]=b[c]);};return a(b,c)}return function(b,c){function d(){this.constructor=b;}a(b,c);b.prototype=null===c?Object.create(c):(d.prototype=c.prototype,new d);}}(),Xb=l&&l.__spreadArrays||function(){for(var a=0,b=0,c=arguments.length;b<c;b++)a+=arguments[b].length;a=Array(a);var d=0;for(b=0;b<c;b++)for(var e=arguments[b],f=0,g=e.length;f<
g;f++,d++)a[d]=e[f];return a};Object.defineProperty(b,"__esModule",{value:!0});var aa=le.extend,cf=Zc.resolve,mb=w.constants.O_RDONLY,Ka=w.constants.O_WRONLY,na=w.constants.O_RDWR,U=w.constants.O_CREAT,nb=w.constants.O_EXCL,Za=w.constants.O_TRUNC,$a=w.constants.O_APPEND,vd=w.constants.O_SYNC,gf=w.constants.O_DIRECTORY,wd=w.constants.F_OK,hf=w.constants.COPYFILE_EXCL,jf=w.constants.COPYFILE_FICLONE_FORCE;var S=Zc.sep;var xd=Zc.relative;var Yb="win32"===L.default.platform,fa={PATH_STR:"path must be a string or Buffer",
FD:"fd must be a file descriptor",MODE_INT:"mode must be an int",CB:"callback must be a function",UID:"uid must be an unsigned int",GID:"gid must be an unsigned int",LEN:"len must be an integer",ATIME:"atime must be an integer",MTIME:"mtime must be an integer",PREFIX:"filename prefix is required",BUFFER:"buffer must be an instance of Buffer or StaticBuffer",OFFSET:"offset must be an integer",LENGTH:"length must be an integer",POSITION:"position must be an integer"},ua;(function(a){a[a.r=mb]="r";a[a["r+"]=
na]="r+";a[a.rs=mb|vd]="rs";a[a.sr=a.rs]="sr";a[a["rs+"]=na|vd]="rs+";a[a["sr+"]=a["rs+"]]="sr+";a[a.w=Ka|U|Za]="w";a[a.wx=Ka|U|Za|nb]="wx";a[a.xw=a.wx]="xw";a[a["w+"]=na|U|Za]="w+";a[a["wx+"]=na|U|Za|nb]="wx+";a[a["xw+"]=a["wx+"]]="xw+";a[a.a=Ka|$a|U]="a";a[a.ax=Ka|$a|U|nb]="ax";a[a.xa=a.ax]="xa";a[a["a+"]=na|$a|U]="a+";a[a["ax+"]=na|$a|U|nb]="ax+";a[a["xa+"]=a["ax+"]]="xa+";})(ua=b.FLAGS||(b.FLAGS={}));b.flagsToNumber=k;a={encoding:"utf8"};var ob=n(a),yd=B(ob),zd=n({flag:"r"}),Ad={encoding:"utf8",
mode:438,flag:ua[ua.w]},Bd=n(Ad),Cd={encoding:"utf8",mode:438,flag:ua[ua.a]},Dd=n(Cd),kf=B(Dd),Ed=n(a),lf=B(Ed),ud={mode:511,recursive:!1},Fd={recursive:!1},Gd=n({encoding:"utf8",withFileTypes:!1}),mf=B(Gd),df={bigint:!1};b.pathToFilename=m;if(Yb){var nf=c,of=We.unixify;c=function(a,b){return of(nf(a,b))};}b.filenameToSteps=v;b.pathToSteps=xa;b.dataToStr=function(a,b){void 0===b&&(b=K.ENCODING_UTF8);return F.Buffer.isBuffer(a)?a.toString(b):a instanceof Uint8Array?F.bufferFrom(a).toString(b):String(a)};
b.dataToBuffer=La;b.bufferToEncoding=$b;b.toUnixTimestamp=ha;a=function(){function a(a){void 0===a&&(a={});this.ino=0;this.inodes={};this.releasedInos=[];this.fds={};this.releasedFds=[];this.maxFiles=1E4;this.openFiles=0;this.promisesApi=me.default(this);this.statWatchers={};this.props=aa({Node:fd.Node,Link:fd.Link,File:fd.File},a);a=this.createLink();a.setNode(this.createNode(!0));var b=this;this.StatWatcher=function(a){function c(){return a.call(this,b)||this}Ja(c,a);return c}(Hd);this.ReadStream=
function(a){function c(){for(var c=[],d=0;d<arguments.length;d++)c[d]=arguments[d];return a.apply(this,Xb([b],c))||this}Ja(c,a);return c}(T);this.WriteStream=function(a){function c(){for(var c=[],d=0;d<arguments.length;d++)c[d]=arguments[d];return a.apply(this,Xb([b],c))||this}Ja(c,a);return c}(R);this.FSWatcher=function(a){function c(){return a.call(this,b)||this}Ja(c,a);return c}(Id);this.root=a;}a.fromJSON=function(b,c){var d=new a;d.fromJSON(b,c);return d};Object.defineProperty(a.prototype,"promises",
{get:function(){if(null===this.promisesApi)throw Error("Promise is not supported in this environment.");return this.promisesApi},enumerable:!0,configurable:!0});a.prototype.createLink=function(a,b,c,d){void 0===c&&(c=!1);if(!a)return new this.props.Link(this,null,"");if(!b)throw Error("createLink: name cannot be empty");return a.createChild(b,this.createNode(c,d))};a.prototype.deleteLink=function(a){var b=a.parent;return b?(b.deleteChild(a),!0):!1};a.prototype.newInoNumber=function(){var a=this.releasedInos.pop();
return a?a:this.ino=(this.ino+1)%4294967295};a.prototype.newFdNumber=function(){var b=this.releasedFds.pop();return "number"===typeof b?b:a.fd--};a.prototype.createNode=function(a,b){void 0===a&&(a=!1);b=new this.props.Node(this.newInoNumber(),b);a&&b.setIsDirectory();return this.inodes[b.ino]=b};a.prototype.getNode=function(a){return this.inodes[a]};a.prototype.deleteNode=function(a){a.del();delete this.inodes[a.ino];this.releasedInos.push(a.ino);};a.prototype.genRndStr=function(){var a=(Math.random()+
1).toString(36).substr(2,6);return 6===a.length?a:this.genRndStr()};a.prototype.getLink=function(a){return this.root.walk(a)};a.prototype.getLinkOrThrow=function(a,b){var c=v(a);c=this.getLink(c);if(!c)throw h("ENOENT",b,a);return c};a.prototype.getResolvedLink=function(a){a="string"===typeof a?v(a):a;for(var b=this.root,c=0;c<a.length;){b=b.getChild(a[c]);if(!b)return null;var d=b.getNode();d.isSymlink()?(a=d.symlink.concat(a.slice(c+1)),b=this.root,c=0):c++;}return b};a.prototype.getResolvedLinkOrThrow=
function(a,b){var c=this.getResolvedLink(a);if(!c)throw h("ENOENT",b,a);return c};a.prototype.resolveSymlinks=function(a){return this.getResolvedLink(a.steps.slice(1))};a.prototype.getLinkAsDirOrThrow=function(a,b){var c=this.getLinkOrThrow(a,b);if(!c.getNode().isDirectory())throw h("ENOTDIR",b,a);return c};a.prototype.getLinkParent=function(a){return this.root.walk(a,a.length-1)};a.prototype.getLinkParentAsDirOrThrow=function(a,b){a=a instanceof Array?a:v(a);var c=this.getLinkParent(a);if(!c)throw h("ENOENT",
b,S+a.join(S));if(!c.getNode().isDirectory())throw h("ENOTDIR",b,S+a.join(S));return c};a.prototype.getFileByFd=function(a){return this.fds[String(a)]};a.prototype.getFileByFdOrThrow=function(a,b){if(a>>>0!==a)throw TypeError(fa.FD);a=this.getFileByFd(a);if(!a)throw h("EBADF",b);return a};a.prototype.getNodeByIdOrCreate=function(a,b,c){if("number"===typeof a){a=this.getFileByFd(a);if(!a)throw Error("File nto found");return a.node}var d=xa(a),e=this.getLink(d);if(e)return e.getNode();if(b&U&&(b=this.getLinkParent(d)))return e=
this.createLink(b,d[d.length-1],!1,c),e.getNode();throw h("ENOENT","getNodeByIdOrCreate",m(a));};a.prototype.wrapAsync=function(a,b,c){var d=this;q(c);$c.default(function(){try{c(null,a.apply(d,b));}catch(va){c(va);}});};a.prototype._toJSON=function(a,b,c){var d;void 0===a&&(a=this.root);void 0===b&&(b={});var e=!0,r=a.children;a.getNode().isFile()&&(r=(d={},d[a.getName()]=a.parent.getChild(a.getName()),d),a=a.parent);for(var D in r){e=!1;r=a.getChild(D);if(!r)throw Error("_toJSON: unexpected undefined");
d=r.getNode();d.isFile()?(r=r.getPath(),c&&(r=xd(c,r)),b[r]=d.getString()):d.isDirectory()&&this._toJSON(r,b,c);}a=a.getPath();c&&(a=xd(c,a));a&&e&&(b[a]=null);return b};a.prototype.toJSON=function(a,b,c){void 0===b&&(b={});void 0===c&&(c=!1);var d=[];if(a){a instanceof Array||(a=[a]);for(var e=0;e<a.length;e++){var r=m(a[e]);(r=this.getResolvedLink(r))&&d.push(r);}}else d.push(this.root);if(!d.length)return b;for(e=0;e<d.length;e++)r=d[e],this._toJSON(r,b,c?r.getPath():"");return b};a.prototype.fromJSON=
function(a,b){void 0===b&&(b=L.default.cwd());for(var d in a){var e=a[d];if("string"===typeof e){d=c(d,b);var r=v(d);1<r.length&&(r=S+r.slice(0,r.length-1).join(S),this.mkdirpBase(r,511));this.writeFileSync(d,e);}else this.mkdirpBase(d,511);}};a.prototype.reset=function(){this.ino=0;this.inodes={};this.releasedInos=[];this.fds={};this.releasedFds=[];this.openFiles=0;this.root=this.createLink();this.root.setNode(this.createNode(!0));};a.prototype.mountSync=function(a,b){this.fromJSON(b,a);};a.prototype.openLink=
function(a,b,c){void 0===c&&(c=!0);if(this.openFiles>=this.maxFiles)throw h("EMFILE","open",a.getPath());var d=a;c&&(d=this.resolveSymlinks(a));if(!d)throw h("ENOENT","open",a.getPath());c=d.getNode();if(c.isDirectory()){if((b&(mb|na|Ka))!==mb)throw h("EISDIR","open",a.getPath());}else if(b&gf)throw h("ENOTDIR","open",a.getPath());if(!(b&Ka||c.canRead()))throw h("EACCES","open",a.getPath());a=new this.props.File(a,c,b,this.newFdNumber());this.fds[a.fd]=a;this.openFiles++;b&Za&&a.truncate();return a};
a.prototype.openFile=function(a,b,c,d){void 0===d&&(d=!0);var e=v(a),r=d?this.getResolvedLink(e):this.getLink(e);if(!r&&b&U){var D=this.getResolvedLink(e.slice(0,e.length-1));if(!D)throw h("ENOENT","open",S+e.join(S));b&U&&"number"===typeof c&&(r=this.createLink(D,e[e.length-1],!1,c));}if(r)return this.openLink(r,b,d);throw h("ENOENT","open",a);};a.prototype.openBase=function(a,b,c,d){void 0===d&&(d=!0);b=this.openFile(a,b,c,d);if(!b)throw h("ENOENT","open",a);return b.fd};a.prototype.openSync=function(a,
b,c){void 0===c&&(c=438);c=M(c);a=m(a);b=k(b);return this.openBase(a,b,c)};a.prototype.open=function(a,b,c,d){var e=c;"function"===typeof c&&(e=438,d=c);c=M(e||438);a=m(a);b=k(b);this.wrapAsync(this.openBase,[a,b,c],d);};a.prototype.closeFile=function(a){this.fds[a.fd]&&(this.openFiles--,delete this.fds[a.fd],this.releasedFds.push(a.fd));};a.prototype.closeSync=function(a){Ya(a);a=this.getFileByFdOrThrow(a,"close");this.closeFile(a);};a.prototype.close=function(a,b){Ya(a);this.wrapAsync(this.closeSync,
[a],b);};a.prototype.openFileOrGetById=function(a,b,c){if("number"===typeof a){a=this.fds[a];if(!a)throw h("ENOENT");return a}return this.openFile(m(a),b,c)};a.prototype.readBase=function(a,b,c,d,e){return this.getFileByFdOrThrow(a).read(b,Number(c),Number(d),e)};a.prototype.readSync=function(a,b,c,d,e){Ya(a);return this.readBase(a,b,c,d,e)};a.prototype.read=function(a,b,c,d,e,f){var r=this;q(f);if(0===d)return L.default.nextTick(function(){f&&f(null,0,b);});$c.default(function(){try{var D=r.readBase(a,
b,c,d,e);f(null,D,b);}catch(pf){f(pf);}});};a.prototype.readFileBase=function(a,b,c){var d="number"===typeof a&&a>>>0===a;if(!d){var e=m(a);e=v(e);if((e=this.getResolvedLink(e))&&e.getNode().isDirectory())throw h("EISDIR","open",e.getPath());a=this.openSync(a,b);}try{var r=$b(this.getFileByFdOrThrow(a).getBuffer(),c);}finally{d||this.closeSync(a);}return r};a.prototype.readFileSync=function(a,b){b=zd(b);var c=k(b.flag);return this.readFileBase(a,c,b.encoding)};a.prototype.readFile=function(a,b,c){c=B(zd)(b,
c);b=c[0];c=c[1];var d=k(b.flag);this.wrapAsync(this.readFileBase,[a,d,b.encoding],c);};a.prototype.writeBase=function(a,b,c,d,e){return this.getFileByFdOrThrow(a,"write").write(b,c,d,e)};a.prototype.writeSync=function(a,b,c,d,e){Ya(a);var r="string"!==typeof b;if(r){var D=(c||0)|0;var f=d;c=e;}else var Xa=d;b=La(b,Xa);r?"undefined"===typeof f&&(f=b.length):(D=0,f=b.length);return this.writeBase(a,b,D,f,c)};a.prototype.write=function(a,b,c,d,e,f){var r=this;Ya(a);var D=typeof b,Xa=typeof c,g=typeof d,
h=typeof e;if("string"!==D)if("function"===Xa)var k=c;else if("function"===g){var lb=c|0;k=d;}else if("function"===h){lb=c|0;var m=d;k=e;}else {lb=c|0;m=d;var n=e;k=f;}else if("function"===Xa)k=c;else if("function"===g)n=c,k=d;else if("function"===h){n=c;var va=d;k=e;}var p=La(b,va);"string"!==D?"undefined"===typeof m&&(m=p.length):(lb=0,m=p.length);var v=q(k);$c.default(function(){try{var c=r.writeBase(a,p,lb,m,n);"string"!==D?v(null,c,p):v(null,c,b);}catch(qf){v(qf);}});};a.prototype.writeFileBase=function(a,
b,c,d){var e="number"===typeof a;a=e?a:this.openBase(m(a),c,d);d=0;var r=b.length;c=c&$a?void 0:0;try{for(;0<r;){var D=this.writeSync(a,b,d,r,c);d+=D;r-=D;void 0!==c&&(c+=D);}}finally{e||this.closeSync(a);}};a.prototype.writeFileSync=function(a,b,c){var d=Bd(c);c=k(d.flag);var e=M(d.mode);b=La(b,d.encoding);this.writeFileBase(a,b,c,e);};a.prototype.writeFile=function(a,b,c,d){var e=c;"function"===typeof c&&(e=Ad,d=c);c=q(d);var r=Bd(e);e=k(r.flag);d=M(r.mode);b=La(b,r.encoding);this.wrapAsync(this.writeFileBase,
[a,b,e,d],c);};a.prototype.linkBase=function(a,b){var c=v(a),d=this.getLink(c);if(!d)throw h("ENOENT","link",a,b);var e=v(b);c=this.getLinkParent(e);if(!c)throw h("ENOENT","link",a,b);e=e[e.length-1];if(c.getChild(e))throw h("EEXIST","link",a,b);a=d.getNode();a.nlink++;c.createChild(e,a);};a.prototype.copyFileBase=function(a,b,c){var d=this.readFileSync(a);if(c&hf&&this.existsSync(b))throw h("EEXIST","copyFile",a,b);if(c&jf)throw h("ENOSYS","copyFile",a,b);this.writeFileBase(b,d,ua.w,438);};a.prototype.copyFileSync=
function(a,b,c){a=m(a);b=m(b);return this.copyFileBase(a,b,(c||0)|0)};a.prototype.copyFile=function(a,b,c,d){a=m(a);b=m(b);if("function"===typeof c)var e=0;else e=c,c=d;q(c);this.wrapAsync(this.copyFileBase,[a,b,e],c);};a.prototype.linkSync=function(a,b){a=m(a);b=m(b);this.linkBase(a,b);};a.prototype.link=function(a,b,c){a=m(a);b=m(b);this.wrapAsync(this.linkBase,[a,b],c);};a.prototype.unlinkBase=function(a){var b=v(a);b=this.getLink(b);if(!b)throw h("ENOENT","unlink",a);if(b.length)throw Error("Dir not empty...");
this.deleteLink(b);a=b.getNode();a.nlink--;0>=a.nlink&&this.deleteNode(a);};a.prototype.unlinkSync=function(a){a=m(a);this.unlinkBase(a);};a.prototype.unlink=function(a,b){a=m(a);this.wrapAsync(this.unlinkBase,[a],b);};a.prototype.symlinkBase=function(a,b){var c=v(b),d=this.getLinkParent(c);if(!d)throw h("ENOENT","symlink",a,b);c=c[c.length-1];if(d.getChild(c))throw h("EEXIST","symlink",a,b);b=d.createChild(c);b.getNode().makeSymlink(v(a));return b};a.prototype.symlinkSync=function(a,b){a=m(a);b=m(b);
this.symlinkBase(a,b);};a.prototype.symlink=function(a,b,c,d){c=q("function"===typeof c?c:d);a=m(a);b=m(b);this.wrapAsync(this.symlinkBase,[a,b],c);};a.prototype.realpathBase=function(a,b){var c=v(a);c=this.getResolvedLink(c);if(!c)throw h("ENOENT","realpath",a);return K.strToEncoding(c.getPath(),b)};a.prototype.realpathSync=function(a,b){return this.realpathBase(m(a),Ed(b).encoding)};a.prototype.realpath=function(a,b,c){c=lf(b,c);b=c[0];c=c[1];a=m(a);this.wrapAsync(this.realpathBase,[a,b.encoding],
c);};a.prototype.lstatBase=function(a,b){void 0===b&&(b=!1);var c=this.getLink(v(a));if(!c)throw h("ENOENT","lstat",a);return ka.default.build(c.getNode(),b)};a.prototype.lstatSync=function(a,b){return this.lstatBase(m(a),e(b).bigint)};a.prototype.lstat=function(a,b,c){c=d(b,c);b=c[0];c=c[1];this.wrapAsync(this.lstatBase,[m(a),b.bigint],c);};a.prototype.statBase=function(a,b){void 0===b&&(b=!1);var c=this.getResolvedLink(v(a));if(!c)throw h("ENOENT","stat",a);return ka.default.build(c.getNode(),b)};
a.prototype.statSync=function(a,b){return this.statBase(m(a),e(b).bigint)};a.prototype.stat=function(a,b,c){c=d(b,c);b=c[0];c=c[1];this.wrapAsync(this.statBase,[m(a),b.bigint],c);};a.prototype.fstatBase=function(a,b){void 0===b&&(b=!1);a=this.getFileByFd(a);if(!a)throw h("EBADF","fstat");return ka.default.build(a.node,b)};a.prototype.fstatSync=function(a,b){return this.fstatBase(a,e(b).bigint)};a.prototype.fstat=function(a,b,c){b=d(b,c);this.wrapAsync(this.fstatBase,[a,b[0].bigint],b[1]);};a.prototype.renameBase=
function(a,b){var c=this.getLink(v(a));if(!c)throw h("ENOENT","rename",a,b);var d=v(b),e=this.getLinkParent(d);if(!e)throw h("ENOENT","rename",a,b);(a=c.parent)&&a.deleteChild(c);c.steps=Xb(e.steps,[d[d.length-1]]);e.setChild(c.getName(),c);};a.prototype.renameSync=function(a,b){a=m(a);b=m(b);this.renameBase(a,b);};a.prototype.rename=function(a,b,c){a=m(a);b=m(b);this.wrapAsync(this.renameBase,[a,b],c);};a.prototype.existsBase=function(a){return !!this.statBase(a)};a.prototype.existsSync=function(a){try{return this.existsBase(m(a))}catch(D){return !1}};
a.prototype.exists=function(a,b){var c=this,d=m(a);if("function"!==typeof b)throw Error(fa.CB);$c.default(function(){try{b(c.existsBase(d));}catch(va){b(!1);}});};a.prototype.accessBase=function(a){this.getLinkOrThrow(a,"access");};a.prototype.accessSync=function(a,b){void 0===b&&(b=wd);a=m(a);this.accessBase(a,b|0);};a.prototype.access=function(a,b,c){var d=wd;"function"!==typeof b&&(d=b|0,b=q(c));a=m(a);this.wrapAsync(this.accessBase,[a,d],b);};a.prototype.appendFileSync=function(a,b,c){void 0===c&&(c=
Cd);c=Dd(c);c.flag&&a>>>0!==a||(c.flag="a");this.writeFileSync(a,b,c);};a.prototype.appendFile=function(a,b,c,d){d=kf(c,d);c=d[0];d=d[1];c.flag&&a>>>0!==a||(c.flag="a");this.writeFile(a,b,c,d);};a.prototype.readdirBase=function(a,b){var c=v(a);c=this.getResolvedLink(c);if(!c)throw h("ENOENT","readdir",a);if(!c.getNode().isDirectory())throw h("ENOTDIR","scandir",a);if(b.withFileTypes){var d=[];for(e in c.children)(a=c.getChild(e))&&d.push(Qc.default.build(a,b.encoding));Yb||"buffer"===b.encoding||d.sort(function(a,
b){return a.name<b.name?-1:a.name>b.name?1:0});return d}var e=[];for(d in c.children)e.push(K.strToEncoding(d,b.encoding));Yb||"buffer"===b.encoding||e.sort();return e};a.prototype.readdirSync=function(a,b){b=Gd(b);a=m(a);return this.readdirBase(a,b)};a.prototype.readdir=function(a,b,c){c=mf(b,c);b=c[0];c=c[1];a=m(a);this.wrapAsync(this.readdirBase,[a,b],c);};a.prototype.readlinkBase=function(a,b){var c=this.getLinkOrThrow(a,"readlink").getNode();if(!c.isSymlink())throw h("EINVAL","readlink",a);a=
S+c.symlink.join(S);return K.strToEncoding(a,b)};a.prototype.readlinkSync=function(a,b){b=ob(b);a=m(a);return this.readlinkBase(a,b.encoding)};a.prototype.readlink=function(a,b,c){c=yd(b,c);b=c[0];c=c[1];a=m(a);this.wrapAsync(this.readlinkBase,[a,b.encoding],c);};a.prototype.fsyncBase=function(a){this.getFileByFdOrThrow(a,"fsync");};a.prototype.fsyncSync=function(a){this.fsyncBase(a);};a.prototype.fsync=function(a,b){this.wrapAsync(this.fsyncBase,[a],b);};a.prototype.fdatasyncBase=function(a){this.getFileByFdOrThrow(a,
"fdatasync");};a.prototype.fdatasyncSync=function(a){this.fdatasyncBase(a);};a.prototype.fdatasync=function(a,b){this.wrapAsync(this.fdatasyncBase,[a],b);};a.prototype.ftruncateBase=function(a,b){this.getFileByFdOrThrow(a,"ftruncate").truncate(b);};a.prototype.ftruncateSync=function(a,b){this.ftruncateBase(a,b);};a.prototype.ftruncate=function(a,b,c){var d="number"===typeof b?b:0;b=q("number"===typeof b?c:b);this.wrapAsync(this.ftruncateBase,[a,d],b);};a.prototype.truncateBase=function(a,b){a=this.openSync(a,
"r+");try{this.ftruncateSync(a,b);}finally{this.closeSync(a);}};a.prototype.truncateSync=function(a,b){if(a>>>0===a)return this.ftruncateSync(a,b);this.truncateBase(a,b);};a.prototype.truncate=function(a,b,c){var d="number"===typeof b?b:0;b=q("number"===typeof b?c:b);if(a>>>0===a)return this.ftruncate(a,d,b);this.wrapAsync(this.truncateBase,[a,d],b);};a.prototype.futimesBase=function(a,b,c){a=this.getFileByFdOrThrow(a,"futimes").node;a.atime=new Date(1E3*b);a.mtime=new Date(1E3*c);};a.prototype.futimesSync=
function(a,b,c){this.futimesBase(a,ha(b),ha(c));};a.prototype.futimes=function(a,b,c,d){this.wrapAsync(this.futimesBase,[a,ha(b),ha(c)],d);};a.prototype.utimesBase=function(a,b,c){a=this.openSync(a,"r+");try{this.futimesBase(a,b,c);}finally{this.closeSync(a);}};a.prototype.utimesSync=function(a,b,c){this.utimesBase(m(a),ha(b),ha(c));};a.prototype.utimes=function(a,b,c,d){this.wrapAsync(this.utimesBase,[m(a),ha(b),ha(c)],d);};a.prototype.mkdirBase=function(a,b){var c=v(a);if(!c.length)throw h("EISDIR","mkdir",
a);var d=this.getLinkParentAsDirOrThrow(a,"mkdir");c=c[c.length-1];if(d.getChild(c))throw h("EEXIST","mkdir",a);d.createChild(c,this.createNode(!0,b));};a.prototype.mkdirpBase=function(a,b){a=v(a);for(var c=this.root,d=0;d<a.length;d++){var e=a[d];if(!c.getNode().isDirectory())throw h("ENOTDIR","mkdir",c.getPath());var f=c.getChild(e);if(f)if(f.getNode().isDirectory())c=f;else throw h("ENOTDIR","mkdir",f.getPath());else c=c.createChild(e,this.createNode(!0,b));}};a.prototype.mkdirSync=function(a,b){b=
f(b);var c=M(b.mode,511);a=m(a);b.recursive?this.mkdirpBase(a,c):this.mkdirBase(a,c);};a.prototype.mkdir=function(a,b,c){var d=f(b);b=q("function"===typeof b?b:c);c=M(d.mode,511);a=m(a);d.recursive?this.wrapAsync(this.mkdirpBase,[a,c],b):this.wrapAsync(this.mkdirBase,[a,c],b);};a.prototype.mkdirpSync=function(a,b){this.mkdirSync(a,{mode:b,recursive:!0});};a.prototype.mkdirp=function(a,b,c){var d="function"===typeof b?void 0:b;b=q("function"===typeof b?b:c);this.mkdir(a,{mode:d,recursive:!0},b);};a.prototype.mkdtempBase=
function(a,b,c){void 0===c&&(c=5);var d=a+this.genRndStr();try{return this.mkdirBase(d,511),K.strToEncoding(d,b)}catch(va){if("EEXIST"===va.code){if(1<c)return this.mkdtempBase(a,b,c-1);throw Error("Could not create temp dir.");}throw va;}};a.prototype.mkdtempSync=function(a,b){b=ob(b).encoding;if(!a||"string"!==typeof a)throw new TypeError("filename prefix is required");qb(a);return this.mkdtempBase(a,b)};a.prototype.mkdtemp=function(a,b,c){c=yd(b,c);b=c[0].encoding;c=c[1];if(!a||"string"!==typeof a)throw new TypeError("filename prefix is required");
qb(a)&&this.wrapAsync(this.mkdtempBase,[a,b],c);};a.prototype.rmdirBase=function(a,b){b=aa({},Fd,b);var c=this.getLinkAsDirOrThrow(a,"rmdir");if(c.length&&!b.recursive)throw h("ENOTEMPTY","rmdir",a);this.deleteLink(c);};a.prototype.rmdirSync=function(a,b){this.rmdirBase(m(a),b);};a.prototype.rmdir=function(a,b,c){var d=aa({},Fd,b);b=q("function"===typeof b?b:c);this.wrapAsync(this.rmdirBase,[m(a),d],b);};a.prototype.fchmodBase=function(a,b){this.getFileByFdOrThrow(a,"fchmod").chmod(b);};a.prototype.fchmodSync=
function(a,b){this.fchmodBase(a,M(b));};a.prototype.fchmod=function(a,b,c){this.wrapAsync(this.fchmodBase,[a,M(b)],c);};a.prototype.chmodBase=function(a,b){a=this.openSync(a,"r+");try{this.fchmodBase(a,b);}finally{this.closeSync(a);}};a.prototype.chmodSync=function(a,b){b=M(b);a=m(a);this.chmodBase(a,b);};a.prototype.chmod=function(a,b,c){b=M(b);a=m(a);this.wrapAsync(this.chmodBase,[a,b],c);};a.prototype.lchmodBase=function(a,b){a=this.openBase(a,na,0,!1);try{this.fchmodBase(a,b);}finally{this.closeSync(a);}};
a.prototype.lchmodSync=function(a,b){b=M(b);a=m(a);this.lchmodBase(a,b);};a.prototype.lchmod=function(a,b,c){b=M(b);a=m(a);this.wrapAsync(this.lchmodBase,[a,b],c);};a.prototype.fchownBase=function(a,b,c){this.getFileByFdOrThrow(a,"fchown").chown(b,c);};a.prototype.fchownSync=function(a,b,c){Ha(b);Ia(c);this.fchownBase(a,b,c);};a.prototype.fchown=function(a,b,c,d){Ha(b);Ia(c);this.wrapAsync(this.fchownBase,[a,b,c],d);};a.prototype.chownBase=function(a,b,c){this.getResolvedLinkOrThrow(a,"chown").getNode().chown(b,
c);};a.prototype.chownSync=function(a,b,c){Ha(b);Ia(c);this.chownBase(m(a),b,c);};a.prototype.chown=function(a,b,c,d){Ha(b);Ia(c);this.wrapAsync(this.chownBase,[m(a),b,c],d);};a.prototype.lchownBase=function(a,b,c){this.getLinkOrThrow(a,"lchown").getNode().chown(b,c);};a.prototype.lchownSync=function(a,b,c){Ha(b);Ia(c);this.lchownBase(m(a),b,c);};a.prototype.lchown=function(a,b,c,d){Ha(b);Ia(c);this.wrapAsync(this.lchownBase,[m(a),b,c],d);};a.prototype.watchFile=function(a,b,c){a=m(a);var d=b;"function"===
typeof d&&(c=b,d=null);if("function"!==typeof c)throw Error('"watchFile()" requires a listener function');b=5007;var e=!0;d&&"object"===typeof d&&("number"===typeof d.interval&&(b=d.interval),"boolean"===typeof d.persistent&&(e=d.persistent));d=this.statWatchers[a];d||(d=new this.StatWatcher,d.start(a,e,b),this.statWatchers[a]=d);d.addListener("change",c);return d};a.prototype.unwatchFile=function(a,b){a=m(a);var c=this.statWatchers[a];c&&("function"===typeof b?c.removeListener("change",b):c.removeAllListeners("change"),
0===c.listenerCount("change")&&(c.stop(),delete this.statWatchers[a]));};a.prototype.createReadStream=function(a,b){return new this.ReadStream(a,b)};a.prototype.createWriteStream=function(a,b){return new this.WriteStream(a,b)};a.prototype.watch=function(a,b,c){a=m(a);var d=b;"function"===typeof b&&(c=b,d=null);var e=ob(d);b=e.persistent;d=e.recursive;e=e.encoding;void 0===b&&(b=!0);void 0===d&&(d=!1);var f=new this.FSWatcher;f.start(a,b,d,e);c&&f.addListener("change",c);return f};a.fd=2147483647;return a}();
b.Volume=a;var Hd=function(a){function b(b){var c=a.call(this)||this;c.onInterval=function(){try{var a=c.vol.statSync(c.filename);c.hasChanged(a)&&(c.emit("change",a,c.prev),c.prev=a);}finally{c.loop();}};c.vol=b;return c}Ja(b,a);b.prototype.loop=function(){this.timeoutRef=this.setTimeout(this.onInterval,this.interval);};b.prototype.hasChanged=function(a){return a.mtimeMs>this.prev.mtimeMs||a.nlink!==this.prev.nlink?!0:!1};b.prototype.start=function(a,b,c){void 0===b&&(b=!0);void 0===c&&(c=5007);this.filename=
m(a);this.setTimeout=b?setTimeout:hd.default;this.interval=c;this.prev=this.vol.statSync(this.filename);this.loop();};b.prototype.stop=function(){clearTimeout(this.timeoutRef);L.default.nextTick(ef,this);};return b}(O.EventEmitter);b.StatWatcher=Hd;var N;lc.inherits(T,Y.Readable);b.ReadStream=T;T.prototype.open=function(){var a=this;this._vol.open(this.path,this.flags,this.mode,function(b,c){b?(a.autoClose&&a.destroy&&a.destroy(),a.emit("error",b)):(a.fd=c,a.emit("open",c),a.read());});};T.prototype._read=
function(a){if("number"!==typeof this.fd)return this.once("open",function(){this._read(a);});if(!this.destroyed){if(!N||128>N.length-N.used)N=F.bufferAllocUnsafe(this._readableState.highWaterMark),N.used=0;var b=N,c=Math.min(N.length-N.used,a),d=N.used;void 0!==this.pos&&(c=Math.min(this.end-this.pos+1,c));if(0>=c)return this.push(null);var e=this;this._vol.read(this.fd,N,N.used,c,this.pos,function(a,c){a?(e.autoClose&&e.destroy&&e.destroy(),e.emit("error",a)):(a=null,0<c&&(e.bytesRead+=c,a=b.slice(d,
d+c)),e.push(a));});void 0!==this.pos&&(this.pos+=c);N.used+=c;}};T.prototype._destroy=function(a,b){this.close(function(c){b(a||c);});};T.prototype.close=function(a){var b=this;if(a)this.once("close",a);if(this.closed||"number"!==typeof this.fd){if("number"!==typeof this.fd){this.once("open",ff);return}return L.default.nextTick(function(){return b.emit("close")})}this.closed=!0;this._vol.close(this.fd,function(a){a?b.emit("error",a):b.emit("close");});this.fd=null;};lc.inherits(R,Y.Writable);b.WriteStream=
R;R.prototype.open=function(){this._vol.open(this.path,this.flags,this.mode,function(a,b){a?(this.autoClose&&this.destroy&&this.destroy(),this.emit("error",a)):(this.fd=b,this.emit("open",b));}.bind(this));};R.prototype._write=function(a,b,c){if(!(a instanceof F.Buffer))return this.emit("error",Error("Invalid data"));if("number"!==typeof this.fd)return this.once("open",function(){this._write(a,b,c);});var d=this;this._vol.write(this.fd,a,0,a.length,this.pos,function(a,b){if(a)return d.autoClose&&d.destroy&&
d.destroy(),c(a);d.bytesWritten+=b;c();});void 0!==this.pos&&(this.pos+=a.length);};R.prototype._writev=function(a,b){if("number"!==typeof this.fd)return this.once("open",function(){this._writev(a,b);});for(var c=this,d=a.length,e=Array(d),f=0,g=0;g<d;g++){var h=a[g].chunk;e[g]=h;f+=h.length;}d=F.Buffer.concat(e);this._vol.write(this.fd,d,0,d.length,this.pos,function(a,d){if(a)return c.destroy&&c.destroy(),b(a);c.bytesWritten+=d;b();});void 0!==this.pos&&(this.pos+=f);};R.prototype._destroy=T.prototype._destroy;
R.prototype.close=T.prototype.close;R.prototype.destroySoon=R.prototype.end;var Id=function(a){function b(b){var c=a.call(this)||this;c._filename="";c._filenameEncoded="";c._recursive=!1;c._encoding=K.ENCODING_UTF8;c._onNodeChange=function(){c._emit("change");};c._onParentChild=function(a){a.getName()===c._getName()&&c._emit("rename");};c._emit=function(a){c.emit("change",a,c._filenameEncoded);};c._persist=function(){c._timer=setTimeout(c._persist,1E6);};c._vol=b;return c}Ja(b,a);b.prototype._getName=
function(){return this._steps[this._steps.length-1]};b.prototype.start=function(a,b,c,d){void 0===b&&(b=!0);void 0===c&&(c=!1);void 0===d&&(d=K.ENCODING_UTF8);this._filename=m(a);this._steps=v(this._filename);this._filenameEncoded=K.strToEncoding(this._filename);this._recursive=c;this._encoding=d;try{this._link=this._vol.getLinkOrThrow(this._filename,"FSWatcher");}catch(Wb){throw b=Error("watch "+this._filename+" "+Wb.code),b.code=Wb.code,b.errno=Wb.code,b;}this._link.getNode().on("change",this._onNodeChange);
this._link.on("child:add",this._onNodeChange);this._link.on("child:delete",this._onNodeChange);if(a=this._link.parent)a.setMaxListeners(a.getMaxListeners()+1),a.on("child:delete",this._onParentChild);b&&this._persist();};b.prototype.close=function(){clearTimeout(this._timer);this._link.getNode().removeListener("change",this._onNodeChange);var a=this._link.parent;a&&a.removeListener("child:delete",this._onParentChild);};return b}(O.EventEmitter);b.FSWatcher=Id;});t(Xe);
var Ye=Xe.pathToFilename,Ze=Xe.filenameToSteps,$e=Xe.Volume,af=u(function(a,b){Object.defineProperty(b,"__esModule",{value:!0});b.fsProps="constants F_OK R_OK W_OK X_OK Stats".split(" ");b.fsSyncMethods="renameSync ftruncateSync truncateSync chownSync fchownSync lchownSync chmodSync fchmodSync lchmodSync statSync lstatSync fstatSync linkSync symlinkSync readlinkSync realpathSync unlinkSync rmdirSync mkdirSync mkdirpSync readdirSync closeSync openSync utimesSync futimesSync fsyncSync writeSync readSync readFileSync writeFileSync appendFileSync existsSync accessSync fdatasyncSync mkdtempSync copyFileSync createReadStream createWriteStream".split(" ");
b.fsAsyncMethods="rename ftruncate truncate chown fchown lchown chmod fchmod lchmod stat lstat fstat link symlink readlink realpath unlink rmdir mkdir mkdirp readdir close open utimes futimes fsync write read readFile writeFile appendFile exists access fdatasync mkdtemp copyFile watchFile unwatchFile watch".split(" ");});t(af);
var bf=u(function(a,b){function c(a){for(var b={F_OK:g,R_OK:h,W_OK:k,X_OK:p,constants:w.constants,Stats:ka.default,Dirent:Qc.default},c=0,d=e;c<d.length;c++){var n=d[c];"function"===typeof a[n]&&(b[n]=a[n].bind(a));}c=0;for(d=f;c<d.length;c++)n=d[c],"function"===typeof a[n]&&(b[n]=a[n].bind(a));b.StatWatcher=a.StatWatcher;b.FSWatcher=a.FSWatcher;b.WriteStream=a.WriteStream;b.ReadStream=a.ReadStream;b.promises=a.promises;b._toUnixTimestamp=Xe.toUnixTimestamp;return b}var d=l&&l.__assign||function(){d=
Object.assign||function(a){for(var b,c=1,d=arguments.length;c<d;c++){b=arguments[c];for(var e in b)Object.prototype.hasOwnProperty.call(b,e)&&(a[e]=b[e]);}return a};return d.apply(this,arguments)};Object.defineProperty(b,"__esModule",{value:!0});var e=af.fsSyncMethods,f=af.fsAsyncMethods,g=w.constants.F_OK,h=w.constants.R_OK,k=w.constants.W_OK,p=w.constants.X_OK;b.Volume=Xe.Volume;b.vol=new Xe.Volume;b.createFsFromVolume=c;b.fs=c(b.vol);a.exports=d(d({},a.exports),b.fs);a.exports.semantic=!0;});t(bf);
var rf=bf.createFsFromVolume;gd.prototype.emit=function(a){for(var b,c,d=[],e=1;e<arguments.length;e++)d[e-1]=arguments[e];e=this.listeners(a);try{for(var f=da(e),g=f.next();!g.done;g=f.next()){var h=g.value;try{h.apply(void 0,ia(d));}catch(k){console.error(k);}}}catch(k){b={error:k};}finally{try{g&&!g.done&&(c=f.return)&&c.call(f);}finally{if(b)throw b.error;}}return 0<e.length};
var sf=function(){function a(){this.volume=new $e;this.fs=rf(this.volume);this.fromJSON({"/dev/stdin":"","/dev/stdout":"","/dev/stderr":""});}a.prototype._toJSON=function(a,c,d){void 0===c&&(c={});var b=!0,f;for(f in a.children){b=!1;var g=a.getChild(f);if(g){var h=g.getNode();h&&h.isFile()?(g=g.getPath(),d&&(g=Yc(d,g)),c[g]=h.getBuffer()):h&&h.isDirectory()&&this._toJSON(g,c,d);}}a=a.getPath();d&&(a=Yc(d,a));a&&b&&(c[a]=null);return c};a.prototype.toJSON=function(a,c,d){var b,f;void 0===c&&(c={});
void 0===d&&(d=!1);var g=[];if(a){a instanceof Array||(a=[a]);try{for(var h=da(a),k=h.next();!k.done;k=h.next()){var p=Ye(k.value),n=this.volume.getResolvedLink(p);n&&g.push(n);}}catch(xa){var q={error:xa};}finally{try{k&&!k.done&&(b=h.return)&&b.call(h);}finally{if(q)throw q.error;}}}else g.push(this.volume.root);if(!g.length)return c;try{for(var B=da(g),m=B.next();!m.done;m=B.next())n=m.value,this._toJSON(n,c,d?n.getPath():"");}catch(xa){var v={error:xa};}finally{try{m&&!m.done&&(f=B.return)&&f.call(B);}finally{if(v)throw v.error;
}}return c};a.prototype.fromJSONFixed=function(a,c){for(var b in c){var e=c[b];if(e?null!==Object.getPrototypeOf(e):null!==e){var f=Ze(b);1<f.length&&(f="/"+f.slice(0,f.length-1).join("/"),a.mkdirpBase(f,511));a.writeFileSync(b,e||"");}else a.mkdirpBase(b,511);}};a.prototype.fromJSON=function(a){this.volume=new $e;this.fromJSONFixed(this.volume,a);this.fs=rf(this.volume);this.volume.releasedFds=[0,1,2];a=this.volume.openSync("/dev/stderr","w");var b=this.volume.openSync("/dev/stdout","w"),d=this.volume.openSync("/dev/stdin",
"r");if(2!==a)throw Error("invalid handle for stderr: "+a);if(1!==b)throw Error("invalid handle for stdout: "+b);if(0!==d)throw Error("invalid handle for stdin: "+d);};a.prototype.getStdOut=function(){return ba(this,void 0,void 0,function(){var a,c=this;return ca(this,function(){a=new Promise(function(a){a(c.fs.readFileSync("/dev/stdout","utf8"));});return [2,a]})})};return a}();

let DATA_VIEW = new DataView(new ArrayBuffer());

function data_view(mem) {
  if (DATA_VIEW.buffer !== mem.buffer) DATA_VIEW = new DataView(mem.buffer);
  return DATA_VIEW;
}

function to_uint32(val) {
  return val >>> 0;
}
const UTF8_DECODER = new TextDecoder('utf-8');

const UTF8_ENCODER = new TextEncoder('utf-8');

function utf8_encode(s, realloc, memory) {
  if (typeof s !== 'string') throw new TypeError('expected a string');
  
  if (s.length === 0) {
    UTF8_ENCODED_LEN = 0;
    return 1;
  }
  
  let alloc_len = 0;
  let ptr = 0;
  let writtenTotal = 0;
  while (s.length > 0) {
    ptr = realloc(ptr, alloc_len, 1, alloc_len + s.length);
    alloc_len += s.length;
    const { read, written } = UTF8_ENCODER.encodeInto(
    s,
    new Uint8Array(memory.buffer, ptr + writtenTotal, alloc_len - writtenTotal),
    );
    writtenTotal += written;
    s = s.slice(read);
  }
  if (alloc_len > writtenTotal)
  ptr = realloc(ptr, alloc_len, 1, writtenTotal);
  UTF8_ENCODED_LEN = writtenTotal;
  return ptr;
}
let UTF8_ENCODED_LEN = 0;

class Slab {
  constructor() {
    this.list = [];
    this.head = 0;
  }
  
  insert(val) {
    if (this.head >= this.list.length) {
      this.list.push({
        next: this.list.length + 1,
        val: undefined,
      });
    }
    const ret = this.head;
    const slot = this.list[ret];
    this.head = slot.next;
    slot.next = -1;
    slot.val = val;
    return ret;
  }
  
  get(idx) {
    if (idx >= this.list.length)
    throw new RangeError('handle index not valid');
    const slot = this.list[idx];
    if (slot.next === -1)
    return slot.val;
    throw new RangeError('handle index not valid');
  }
  
  remove(idx) {
    const ret = this.get(idx); // validate the slot
    const slot = this.list[idx];
    slot.val = undefined;
    slot.next = this.head;
    this.head = idx;
    return ret;
  }
}

function throw_invalid_bool() {
  throw new RangeError("invalid variant discriminant for bool");
}

class RbAbiGuest {
  constructor() {
    this._resource0_slab = new Slab();
    this._resource1_slab = new Slab();
  }
  addToImports(imports) {
    if (!("canonical_abi" in imports)) imports["canonical_abi"] = {};
    
    imports.canonical_abi['resource_drop_rb-iseq'] = i => {
      this._resource0_slab.remove(i).drop();
    };
    imports.canonical_abi['resource_clone_rb-iseq'] = i => {
      const obj = this._resource0_slab.get(i);
      return this._resource0_slab.insert(obj.clone())
    };
    imports.canonical_abi['resource_get_rb-iseq'] = i => {
      return this._resource0_slab.get(i)._wasm_val;
    };
    imports.canonical_abi['resource_new_rb-iseq'] = i => {
      this._registry0;
      return this._resource0_slab.insert(new RbIseq(i, this));
    };
    
    imports.canonical_abi['resource_drop_rb-abi-value'] = i => {
      this._resource1_slab.remove(i).drop();
    };
    imports.canonical_abi['resource_clone_rb-abi-value'] = i => {
      const obj = this._resource1_slab.get(i);
      return this._resource1_slab.insert(obj.clone())
    };
    imports.canonical_abi['resource_get_rb-abi-value'] = i => {
      return this._resource1_slab.get(i)._wasm_val;
    };
    imports.canonical_abi['resource_new_rb-abi-value'] = i => {
      this._registry1;
      return this._resource1_slab.insert(new RbAbiValue(i, this));
    };
  }
  
  async instantiate(module, imports) {
    imports = imports || {};
    this.addToImports(imports);
    
    if (module instanceof WebAssembly.Instance) {
      this.instance = module;
    } else if (module instanceof WebAssembly.Module) {
      this.instance = await WebAssembly.instantiate(module, imports);
    } else if (module instanceof ArrayBuffer || module instanceof Uint8Array) {
      const { instance } = await WebAssembly.instantiate(module, imports);
      this.instance = instance;
    } else {
      const { instance } = await WebAssembly.instantiateStreaming(module, imports);
      this.instance = instance;
    }
    this._exports = this.instance.exports;
    this._registry0 = new FinalizationRegistry(this._exports['canonical_abi_drop_rb-iseq']);
    this._registry1 = new FinalizationRegistry(this._exports['canonical_abi_drop_rb-abi-value']);
  }
  rubyShowVersion() {
    this._exports['ruby-show-version: func() -> ()']();
  }
  rubyInit() {
    this._exports['ruby-init: func() -> ()']();
  }
  rubySysinit(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const vec1 = arg0;
    const len1 = vec1.length;
    const result1 = realloc(0, 0, 4, len1 * 8);
    for (let i = 0; i < vec1.length; i++) {
      const e = vec1[i];
      const base = result1 + i * 8;
      const ptr0 = utf8_encode(e, realloc, memory);
      const len0 = UTF8_ENCODED_LEN;
      data_view(memory).setInt32(base + 4, len0, true);
      data_view(memory).setInt32(base + 0, ptr0, true);
    }
    this._exports['ruby-sysinit: func(args: list<string>) -> ()'](result1, len1);
  }
  rubyOptions(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const vec1 = arg0;
    const len1 = vec1.length;
    const result1 = realloc(0, 0, 4, len1 * 8);
    for (let i = 0; i < vec1.length; i++) {
      const e = vec1[i];
      const base = result1 + i * 8;
      const ptr0 = utf8_encode(e, realloc, memory);
      const len0 = UTF8_ENCODED_LEN;
      data_view(memory).setInt32(base + 4, len0, true);
      data_view(memory).setInt32(base + 0, ptr0, true);
    }
    const ret = this._exports['ruby-options: func(args: list<string>) -> handle<rb-iseq>'](result1, len1);
    return this._resource0_slab.remove(ret);
  }
  rubyScript(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const ptr0 = utf8_encode(arg0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    this._exports['ruby-script: func(name: string) -> ()'](ptr0, len0);
  }
  rubyInitLoadpath() {
    this._exports['ruby-init-loadpath: func() -> ()']();
  }
  rbEvalStringProtect(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const ptr0 = utf8_encode(arg0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    const ret = this._exports['rb-eval-string-protect: func(str: string) -> tuple<handle<rb-abi-value>, s32>'](ptr0, len0);
    return [this._resource1_slab.remove(data_view(memory).getInt32(ret + 0, true)), data_view(memory).getInt32(ret + 4, true)];
  }
  rbFuncallvProtect(arg0, arg1, arg2) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const obj0 = arg0;
    if (!(obj0 instanceof RbAbiValue)) throw new TypeError('expected instance of RbAbiValue');
    const vec2 = arg2;
    const len2 = vec2.length;
    const result2 = realloc(0, 0, 4, len2 * 4);
    for (let i = 0; i < vec2.length; i++) {
      const e = vec2[i];
      const base = result2 + i * 4;
      const obj1 = e;
      if (!(obj1 instanceof RbAbiValue)) throw new TypeError('expected instance of RbAbiValue');
      data_view(memory).setInt32(base + 0, this._resource1_slab.insert(obj1.clone()), true);
    }
    const ret = this._exports['rb-funcallv-protect: func(recv: handle<rb-abi-value>, mid: u32, args: list<handle<rb-abi-value>>) -> tuple<handle<rb-abi-value>, s32>'](this._resource1_slab.insert(obj0.clone()), to_uint32(arg1), result2, len2);
    return [this._resource1_slab.remove(data_view(memory).getInt32(ret + 0, true)), data_view(memory).getInt32(ret + 4, true)];
  }
  rbIntern(arg0) {
    const memory = this._exports.memory;
    const realloc = this._exports["cabi_realloc"];
    const ptr0 = utf8_encode(arg0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    const ret = this._exports['rb-intern: func(name: string) -> u32'](ptr0, len0);
    return ret >>> 0;
  }
  rbErrinfo() {
    const ret = this._exports['rb-errinfo: func() -> handle<rb-abi-value>']();
    return this._resource1_slab.remove(ret);
  }
  rbClearErrinfo() {
    this._exports['rb-clear-errinfo: func() -> ()']();
  }
  rstringPtr(arg0) {
    const memory = this._exports.memory;
    const obj0 = arg0;
    if (!(obj0 instanceof RbAbiValue)) throw new TypeError('expected instance of RbAbiValue');
    const ret = this._exports['rstring-ptr: func(value: handle<rb-abi-value>) -> string'](this._resource1_slab.insert(obj0.clone()));
    const ptr1 = data_view(memory).getInt32(ret + 0, true);
    const len1 = data_view(memory).getInt32(ret + 4, true);
    const result1 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr1, len1));
    this._exports["cabi_post_rstring-ptr"](ret);
    return result1;
  }
  rbVmBugreport() {
    this._exports['rb-vm-bugreport: func() -> ()']();
  }
}

class RbIseq {
  constructor(wasm_val, obj) {
    this._wasm_val = wasm_val;
    this._obj = obj;
    this._refcnt = 1;
    obj._registry0.register(this, wasm_val, this);
  }
  
  clone() {
    this._refcnt += 1;
    return this;
  }
  
  drop() {
    this._refcnt -= 1;
    if (this._refcnt !== 0)
    return;
    this._obj._registry0.unregister(this);
    const dtor = this._obj._exports['canonical_abi_drop_rb-iseq'];
    const wasm_val = this._wasm_val;
    delete this._obj;
    delete this._refcnt;
    delete this._wasm_val;
    dtor(wasm_val);
  }
}

class RbAbiValue {
  constructor(wasm_val, obj) {
    this._wasm_val = wasm_val;
    this._obj = obj;
    this._refcnt = 1;
    obj._registry1.register(this, wasm_val, this);
  }
  
  clone() {
    this._refcnt += 1;
    return this;
  }
  
  drop() {
    this._refcnt -= 1;
    if (this._refcnt !== 0)
    return;
    this._obj._registry1.unregister(this);
    const dtor = this._obj._exports['canonical_abi_drop_rb-abi-value'];
    const wasm_val = this._wasm_val;
    delete this._obj;
    delete this._refcnt;
    delete this._wasm_val;
    dtor(wasm_val);
  }
}

function addRbJsAbiHostToImports(imports, obj, get_export) {
  if (!("rb-js-abi-host" in imports)) imports["rb-js-abi-host"] = {};
  imports["rb-js-abi-host"]["eval-js: func(code: string) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"] = function(arg0, arg1, arg2) {
    const memory = get_export("memory");
    const ptr0 = arg0;
    const len0 = arg1;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.evalJs(result0);
    const variant1 = ret0;
    switch (variant1.tag) {
      case "success": {
        const e = variant1.val;
        data_view(memory).setInt8(arg2 + 0, 0, true);
        data_view(memory).setInt32(arg2 + 4, resources0.insert(e), true);
        break;
      }
      case "failure": {
        const e = variant1.val;
        data_view(memory).setInt8(arg2 + 0, 1, true);
        data_view(memory).setInt32(arg2 + 4, resources0.insert(e), true);
        break;
      }
      default:
      throw new RangeError("invalid variant specified for JsAbiResult");
    }
  };
  imports["rb-js-abi-host"]["is-js: func(value: handle<js-abi-value>) -> bool"] = function(arg0) {
    const ret0 = obj.isJs(resources0.get(arg0));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["instance-of: func(value: handle<js-abi-value>, klass: handle<js-abi-value>) -> bool"] = function(arg0, arg1) {
    const ret0 = obj.instanceOf(resources0.get(arg0), resources0.get(arg1));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["global-this: func() -> handle<js-abi-value>"] = function() {
    const ret0 = obj.globalThis();
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["int-to-js-number: func(value: s32) -> handle<js-abi-value>"] = function(arg0) {
    const ret0 = obj.intToJsNumber(arg0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["string-to-js-string: func(value: string) -> handle<js-abi-value>"] = function(arg0, arg1) {
    const memory = get_export("memory");
    const ptr0 = arg0;
    const len0 = arg1;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.stringToJsString(result0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["bool-to-js-bool: func(value: bool) -> handle<js-abi-value>"] = function(arg0) {
    const bool0 = arg0;
    const ret0 = obj.boolToJsBool(bool0 == 0 ? false : (bool0 == 1 ? true : throw_invalid_bool()));
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["proc-to-js-function: func(value: u32) -> handle<js-abi-value>"] = function(arg0) {
    const ret0 = obj.procToJsFunction(arg0 >>> 0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["rb-object-to-js-rb-value: func(raw-rb-abi-value: u32) -> handle<js-abi-value>"] = function(arg0) {
    const ret0 = obj.rbObjectToJsRbValue(arg0 >>> 0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["js-value-to-string: func(value: handle<js-abi-value>) -> string"] = function(arg0, arg1) {
    const memory = get_export("memory");
    const realloc = get_export("cabi_realloc");
    const ret0 = obj.jsValueToString(resources0.get(arg0));
    const ptr0 = utf8_encode(ret0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    data_view(memory).setInt32(arg1 + 4, len0, true);
    data_view(memory).setInt32(arg1 + 0, ptr0, true);
  };
  imports["rb-js-abi-host"]["js-value-to-integer: func(value: handle<js-abi-value>) -> variant { f64(float64), bignum(string) }"] = function(arg0, arg1) {
    const memory = get_export("memory");
    const realloc = get_export("cabi_realloc");
    const ret0 = obj.jsValueToInteger(resources0.get(arg0));
    const variant1 = ret0;
    switch (variant1.tag) {
      case "f64": {
        const e = variant1.val;
        data_view(memory).setInt8(arg1 + 0, 0, true);
        data_view(memory).setFloat64(arg1 + 8, +e, true);
        break;
      }
      case "bignum": {
        const e = variant1.val;
        data_view(memory).setInt8(arg1 + 0, 1, true);
        const ptr0 = utf8_encode(e, realloc, memory);
        const len0 = UTF8_ENCODED_LEN;
        data_view(memory).setInt32(arg1 + 12, len0, true);
        data_view(memory).setInt32(arg1 + 8, ptr0, true);
        break;
      }
      default:
      throw new RangeError("invalid variant specified for RawInteger");
    }
  };
  imports["rb-js-abi-host"]["export-js-value-to-host: func(value: handle<js-abi-value>) -> ()"] = function(arg0) {
    obj.exportJsValueToHost(resources0.get(arg0));
  };
  imports["rb-js-abi-host"]["import-js-value-from-host: func() -> handle<js-abi-value>"] = function() {
    const ret0 = obj.importJsValueFromHost();
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["js-value-typeof: func(value: handle<js-abi-value>) -> string"] = function(arg0, arg1) {
    const memory = get_export("memory");
    const realloc = get_export("cabi_realloc");
    const ret0 = obj.jsValueTypeof(resources0.get(arg0));
    const ptr0 = utf8_encode(ret0, realloc, memory);
    const len0 = UTF8_ENCODED_LEN;
    data_view(memory).setInt32(arg1 + 4, len0, true);
    data_view(memory).setInt32(arg1 + 0, ptr0, true);
  };
  imports["rb-js-abi-host"]["js-value-equal: func(lhs: handle<js-abi-value>, rhs: handle<js-abi-value>) -> bool"] = function(arg0, arg1) {
    const ret0 = obj.jsValueEqual(resources0.get(arg0), resources0.get(arg1));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["js-value-strictly-equal: func(lhs: handle<js-abi-value>, rhs: handle<js-abi-value>) -> bool"] = function(arg0, arg1) {
    const ret0 = obj.jsValueStrictlyEqual(resources0.get(arg0), resources0.get(arg1));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["reflect-apply: func(target: handle<js-abi-value>, this-argument: handle<js-abi-value>, arguments: list<handle<js-abi-value>>) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"] = function(arg0, arg1, arg2, arg3, arg4) {
    const memory = get_export("memory");
    const len0 = arg3;
    const base0 = arg2;
    const result0 = [];
    for (let i = 0; i < len0; i++) {
      const base = base0 + i * 4;
      result0.push(resources0.get(data_view(memory).getInt32(base + 0, true)));
    }
    const ret0 = obj.reflectApply(resources0.get(arg0), resources0.get(arg1), result0);
    const variant1 = ret0;
    switch (variant1.tag) {
      case "success": {
        const e = variant1.val;
        data_view(memory).setInt8(arg4 + 0, 0, true);
        data_view(memory).setInt32(arg4 + 4, resources0.insert(e), true);
        break;
      }
      case "failure": {
        const e = variant1.val;
        data_view(memory).setInt8(arg4 + 0, 1, true);
        data_view(memory).setInt32(arg4 + 4, resources0.insert(e), true);
        break;
      }
      default:
      throw new RangeError("invalid variant specified for JsAbiResult");
    }
  };
  imports["rb-js-abi-host"]["reflect-construct: func(target: handle<js-abi-value>, arguments: list<handle<js-abi-value>>) -> handle<js-abi-value>"] = function(arg0, arg1, arg2) {
    const memory = get_export("memory");
    const len0 = arg2;
    const base0 = arg1;
    const result0 = [];
    for (let i = 0; i < len0; i++) {
      const base = base0 + i * 4;
      result0.push(resources0.get(data_view(memory).getInt32(base + 0, true)));
    }
    const ret0 = obj.reflectConstruct(resources0.get(arg0), result0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["reflect-delete-property: func(target: handle<js-abi-value>, property-key: string) -> bool"] = function(arg0, arg1, arg2) {
    const memory = get_export("memory");
    const ptr0 = arg1;
    const len0 = arg2;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.reflectDeleteProperty(resources0.get(arg0), result0);
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["reflect-get: func(target: handle<js-abi-value>, property-key: string) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"] = function(arg0, arg1, arg2, arg3) {
    const memory = get_export("memory");
    const ptr0 = arg1;
    const len0 = arg2;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.reflectGet(resources0.get(arg0), result0);
    const variant1 = ret0;
    switch (variant1.tag) {
      case "success": {
        const e = variant1.val;
        data_view(memory).setInt8(arg3 + 0, 0, true);
        data_view(memory).setInt32(arg3 + 4, resources0.insert(e), true);
        break;
      }
      case "failure": {
        const e = variant1.val;
        data_view(memory).setInt8(arg3 + 0, 1, true);
        data_view(memory).setInt32(arg3 + 4, resources0.insert(e), true);
        break;
      }
      default:
      throw new RangeError("invalid variant specified for JsAbiResult");
    }
  };
  imports["rb-js-abi-host"]["reflect-get-own-property-descriptor: func(target: handle<js-abi-value>, property-key: string) -> handle<js-abi-value>"] = function(arg0, arg1, arg2) {
    const memory = get_export("memory");
    const ptr0 = arg1;
    const len0 = arg2;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.reflectGetOwnPropertyDescriptor(resources0.get(arg0), result0);
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["reflect-get-prototype-of: func(target: handle<js-abi-value>) -> handle<js-abi-value>"] = function(arg0) {
    const ret0 = obj.reflectGetPrototypeOf(resources0.get(arg0));
    return resources0.insert(ret0);
  };
  imports["rb-js-abi-host"]["reflect-has: func(target: handle<js-abi-value>, property-key: string) -> bool"] = function(arg0, arg1, arg2) {
    const memory = get_export("memory");
    const ptr0 = arg1;
    const len0 = arg2;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.reflectHas(resources0.get(arg0), result0);
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["reflect-is-extensible: func(target: handle<js-abi-value>) -> bool"] = function(arg0) {
    const ret0 = obj.reflectIsExtensible(resources0.get(arg0));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["reflect-own-keys: func(target: handle<js-abi-value>) -> list<handle<js-abi-value>>"] = function(arg0, arg1) {
    const memory = get_export("memory");
    const realloc = get_export("cabi_realloc");
    const ret0 = obj.reflectOwnKeys(resources0.get(arg0));
    const vec0 = ret0;
    const len0 = vec0.length;
    const result0 = realloc(0, 0, 4, len0 * 4);
    for (let i = 0; i < vec0.length; i++) {
      const e = vec0[i];
      const base = result0 + i * 4;
      data_view(memory).setInt32(base + 0, resources0.insert(e), true);
    }
    data_view(memory).setInt32(arg1 + 4, len0, true);
    data_view(memory).setInt32(arg1 + 0, result0, true);
  };
  imports["rb-js-abi-host"]["reflect-prevent-extensions: func(target: handle<js-abi-value>) -> bool"] = function(arg0) {
    const ret0 = obj.reflectPreventExtensions(resources0.get(arg0));
    return ret0 ? 1 : 0;
  };
  imports["rb-js-abi-host"]["reflect-set: func(target: handle<js-abi-value>, property-key: string, value: handle<js-abi-value>) -> variant { success(handle<js-abi-value>), failure(handle<js-abi-value>) }"] = function(arg0, arg1, arg2, arg3, arg4) {
    const memory = get_export("memory");
    const ptr0 = arg1;
    const len0 = arg2;
    const result0 = UTF8_DECODER.decode(new Uint8Array(memory.buffer, ptr0, len0));
    const ret0 = obj.reflectSet(resources0.get(arg0), result0, resources0.get(arg3));
    const variant1 = ret0;
    switch (variant1.tag) {
      case "success": {
        const e = variant1.val;
        data_view(memory).setInt8(arg4 + 0, 0, true);
        data_view(memory).setInt32(arg4 + 4, resources0.insert(e), true);
        break;
      }
      case "failure": {
        const e = variant1.val;
        data_view(memory).setInt8(arg4 + 0, 1, true);
        data_view(memory).setInt32(arg4 + 4, resources0.insert(e), true);
        break;
      }
      default:
      throw new RangeError("invalid variant specified for JsAbiResult");
    }
  };
  imports["rb-js-abi-host"]["reflect-set-prototype-of: func(target: handle<js-abi-value>, prototype: handle<js-abi-value>) -> bool"] = function(arg0, arg1) {
    const ret0 = obj.reflectSetPrototypeOf(resources0.get(arg0), resources0.get(arg1));
    return ret0 ? 1 : 0;
  };
  if (!("canonical_abi" in imports)) imports["canonical_abi"] = {};
  
  const resources0 = new Slab();
  imports.canonical_abi["resource_drop_js-abi-value"] = (i) => {
    const val = resources0.remove(i);
    if (obj.dropJsAbiValue)
    obj.dropJsAbiValue(val);
  };
}

/**
 * A Ruby VM instance
 *
 * @example
 *
 * const wasi = new WASI();
 * const vm = new RubyVM();
 * const imports = {
 *   wasi_snapshot_preview1: wasi.wasiImport,
 * };
 *
 * vm.addToImports(imports);
 *
 * const instance = await WebAssembly.instantiate(rubyModule, imports);
 * await vm.setInstance(instance);
 * wasi.initialize(instance);
 * vm.initialize();
 *
 */
class RubyVM {
    constructor() {
        this.instance = null;
        this.guest = new RbAbiGuest();
        this.transport = new JsValueTransport();
        this.exceptionFormatter = new RbExceptionFormatter();
    }
    /**
     * Initialize the Ruby VM with the given command line arguments
     * @param args The command line arguments to pass to Ruby. Must be
     * an array of strings starting with the Ruby program name.
     */
    initialize(args = ["ruby.wasm", "--disable-gems", "-EUTF-8", "-e_=0"]) {
        const c_args = args.map((arg) => arg + "\0");
        this.guest.rubyInit();
        this.guest.rubySysinit(c_args);
        this.guest.rubyOptions(c_args);
    }
    /**
     * Set a given instance to interact JavaScript and Ruby's
     * WebAssembly instance. This method must be called before calling
     * Ruby API.
     *
     * @param instance The WebAssembly instance to interact with. Must
     * be instantiated from a Ruby built with JS extension, and built
     * with Reactor ABI instead of command line.
     */
    async setInstance(instance) {
        this.instance = instance;
        await this.guest.instantiate(instance);
    }
    /**
     * Add intrinsic import entries, which is necessary to interact JavaScript
     * and Ruby's WebAssembly instance.
     * @param imports The import object to add to the WebAssembly instance
     */
    addToImports(imports) {
        this.guest.addToImports(imports);
        function wrapTry(f) {
            return (...args) => {
                try {
                    return { tag: "success", val: f(...args) };
                }
                catch (e) {
                    return { tag: "failure", val: e };
                }
            };
        }
        addRbJsAbiHostToImports(imports, {
            evalJs: wrapTry((code) => {
                return Function(code)();
            }),
            isJs: (value) => {
                // Just for compatibility with the old JS API
                return true;
            },
            globalThis: () => {
                if (typeof globalThis !== "undefined") {
                    return globalThis;
                }
                else if (typeof global$1 !== "undefined") {
                    return global$1;
                }
                else if (typeof window !== "undefined") {
                    return window;
                }
                throw new Error("unable to locate global object");
            },
            intToJsNumber: (value) => {
                return value;
            },
            stringToJsString: (value) => {
                return value;
            },
            boolToJsBool: (value) => {
                return value;
            },
            procToJsFunction: (rawRbAbiValue) => {
                const rbValue = this.rbValueofPointer(rawRbAbiValue);
                return (...args) => {
                    rbValue.call("call", ...args.map((arg) => this.wrap(arg)));
                };
            },
            rbObjectToJsRbValue: (rawRbAbiValue) => {
                return this.rbValueofPointer(rawRbAbiValue);
            },
            jsValueToString: (value) => {
                // According to the [spec](https://tc39.es/ecma262/multipage/text-processing.html#sec-string-constructor-string-value)
                // `String(value)` always returns a string.
                return String(value);
            },
            jsValueToInteger(value) {
                if (typeof value === "number") {
                    return { tag: "f64", val: value };
                }
                else if (typeof value === "bigint") {
                    return { tag: "bignum", val: BigInt(value).toString(10) + "\0" };
                }
                else if (typeof value === "string") {
                    return { tag: "bignum", val: value + "\0" };
                }
                else if (typeof value === "undefined") {
                    return { tag: "f64", val: 0 };
                }
                else {
                    return { tag: "f64", val: Number(value) };
                }
            },
            exportJsValueToHost: (value) => {
                // See `JsValueExporter` for the reason why we need to do this
                this.transport.takeJsValue(value);
            },
            importJsValueFromHost: () => {
                return this.transport.consumeJsValue();
            },
            instanceOf: (value, klass) => {
                if (typeof klass === "function") {
                    return value instanceof klass;
                }
                else {
                    return false;
                }
            },
            jsValueTypeof(value) {
                return typeof value;
            },
            jsValueEqual(lhs, rhs) {
                return lhs == rhs;
            },
            jsValueStrictlyEqual(lhs, rhs) {
                return lhs === rhs;
            },
            reflectApply: wrapTry((target, thisArgument, args) => {
                return Reflect.apply(target, thisArgument, args);
            }),
            reflectConstruct: function (target, args) {
                throw new Error("Function not implemented.");
            },
            reflectDeleteProperty: function (target, propertyKey) {
                throw new Error("Function not implemented.");
            },
            reflectGet: wrapTry((target, propertyKey) => {
                return target[propertyKey];
            }),
            reflectGetOwnPropertyDescriptor: function (target, propertyKey) {
                throw new Error("Function not implemented.");
            },
            reflectGetPrototypeOf: function (target) {
                throw new Error("Function not implemented.");
            },
            reflectHas: function (target, propertyKey) {
                throw new Error("Function not implemented.");
            },
            reflectIsExtensible: function (target) {
                throw new Error("Function not implemented.");
            },
            reflectOwnKeys: function (target) {
                throw new Error("Function not implemented.");
            },
            reflectPreventExtensions: function (target) {
                throw new Error("Function not implemented.");
            },
            reflectSet: wrapTry((target, propertyKey, value) => {
                return Reflect.set(target, propertyKey, value);
            }),
            reflectSetPrototypeOf: function (target, prototype) {
                throw new Error("Function not implemented.");
            },
        }, (name) => {
            return this.instance.exports[name];
        });
    }
    /**
     * Print the Ruby version to stdout
     */
    printVersion() {
        this.guest.rubyShowVersion();
    }
    /**
     * Runs a string of Ruby code from JavaScript
     * @param code The Ruby code to run
     * @returns the result of the last expression
     *
     * @example
     * vm.eval("puts 'hello world'");
     * const result = vm.eval("1 + 2");
     * console.log(result.toString()); // 3
     *
     */
    eval(code) {
        return evalRbCode(this, this.privateObject(), code);
    }
    /**
     * Runs a string of Ruby code with top-level `JS::Object#await`
     * Returns a promise that resolves when execution completes.
     * @param code The Ruby code to run
     * @returns a promise that resolves to the result of the last expression
     *
     * @example
     * const text = await vm.evalAsync(`
     *   require 'js'
     *   response = JS.global.fetch('https://example.com').await
     *   response.text.await
     * `);
     * console.log(text.toString()); // <html>...</html>
     */
    evalAsync(code) {
        const JS = this.eval("require 'js'; JS");
        return new Promise((resolve, reject) => {
            JS.call("__eval_async_rb", this.wrap(code), this.wrap({
                resolve,
                reject: (error) => {
                    reject(new RbError(this.exceptionFormatter.format(error, this, this.privateObject())));
                },
            }));
        });
    }
    /**
     * Wrap a JavaScript value into a Ruby JS::Object
     * @param value The value to convert to RbValue
     * @returns the RbValue object representing the given JS value
     *
     * @example
     * const hash = vm.eval(`Hash.new`)
     * hash.call("store", vm.eval(`"key1"`), vm.wrap(new Object()));
     */
    wrap(value) {
        return this.transport.importJsValue(value, this);
    }
    privateObject() {
        return {
            transport: this.transport,
            exceptionFormatter: this.exceptionFormatter,
        };
    }
    rbValueofPointer(pointer) {
        const abiValue = new RbAbiValue(pointer, this.guest);
        return new RbValue(abiValue, this, this.privateObject());
    }
}
/**
 * Export a JS value held by the Ruby VM to the JS environment.
 * This is implemented in a dirty way since wit cannot reference resources
 * defined in other interfaces.
 * In our case, we can't express `function(v: rb-abi-value) -> js-abi-value`
 * because `rb-js-abi-host.wit`, that defines `js-abi-value`, is implemented
 * by embedder side (JS) but `rb-abi-guest.wit`, that defines `rb-abi-value`
 * is implemented by guest side (Wasm).
 *
 * This class is a helper to export by:
 * 1. Call `function __export_to_js(v: rb-abi-value)` defined in guest from embedder side.
 * 2. Call `function takeJsValue(v: js-abi-value)` defined in embedder from guest side with
 *    underlying JS value of given `rb-abi-value`.
 * 3. Then `takeJsValue` implementation escapes the given JS value to the `_takenJsValues`
 *    stored in embedder side.
 * 4. Finally, embedder side can take `_takenJsValues`.
 *
 * Note that `exportJsValue` is not reentrant.
 *
 * @private
 */
class JsValueTransport {
    constructor() {
        this._takenJsValue = null;
    }
    takeJsValue(value) {
        this._takenJsValue = value;
    }
    consumeJsValue() {
        return this._takenJsValue;
    }
    exportJsValue(value) {
        value.call("__export_to_js");
        return this._takenJsValue;
    }
    importJsValue(value, vm) {
        this._takenJsValue = value;
        return vm.eval('require "js"; JS::Object').call("__import_from_js");
    }
}
/**
 * A RbValue is an object that represents a value in Ruby
 */
class RbValue {
    /**
     * @hideconstructor
     */
    constructor(inner, vm, privateObject) {
        this.inner = inner;
        this.vm = vm;
        this.privateObject = privateObject;
    }
    /**
     * Call a given method with given arguments
     *
     * @param callee name of the Ruby method to call
     * @param args arguments to pass to the method. Must be an array of RbValue
     *
     * @example
     * const ary = vm.eval("[1, 2, 3]");
     * ary.call("push", 4);
     * console.log(ary.call("sample").toString());
     *
     */
    call(callee, ...args) {
        const innerArgs = args.map((arg) => arg.inner);
        return new RbValue(callRbMethod(this.vm, this.privateObject, this.inner, callee, innerArgs), this.vm, this.privateObject);
    }
    /**
     * @see {@link https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Symbol/toPrimitive}
     * @param hint Preferred type of the result primitive value. `"number"`, `"string"`, or `"default"`.
     */
    [Symbol.toPrimitive](hint) {
        if (hint === "string" || hint === "default") {
            return this.toString();
        }
        else if (hint === "number") {
            return null;
        }
        return null;
    }
    /**
     * Returns a string representation of the value by calling `to_s`
     */
    toString() {
        const rbString = callRbMethod(this.vm, this.privateObject, this.inner, "to_s", []);
        return this.vm.guest.rstringPtr(rbString);
    }
    /**
     * Returns a JavaScript object representation of the value
     * by calling `to_js`.
     *
     * Returns null if the value is not convertible to a JavaScript object.
     */
    toJS() {
        const JS = this.vm.eval("JS");
        const jsValue = JS.call("try_convert", this);
        if (jsValue.call("nil?").toString() === "true") {
            return null;
        }
        return this.privateObject.transport.exportJsValue(jsValue);
    }
}
var ruby_tag_type;
(function (ruby_tag_type) {
    ruby_tag_type[ruby_tag_type["None"] = 0] = "None";
    ruby_tag_type[ruby_tag_type["Return"] = 1] = "Return";
    ruby_tag_type[ruby_tag_type["Break"] = 2] = "Break";
    ruby_tag_type[ruby_tag_type["Next"] = 3] = "Next";
    ruby_tag_type[ruby_tag_type["Retry"] = 4] = "Retry";
    ruby_tag_type[ruby_tag_type["Redo"] = 5] = "Redo";
    ruby_tag_type[ruby_tag_type["Raise"] = 6] = "Raise";
    ruby_tag_type[ruby_tag_type["Throw"] = 7] = "Throw";
    ruby_tag_type[ruby_tag_type["Fatal"] = 8] = "Fatal";
    ruby_tag_type[ruby_tag_type["Mask"] = 15] = "Mask";
})(ruby_tag_type || (ruby_tag_type = {}));
class RbExceptionFormatter {
    constructor() {
        this.literalsCache = null;
    }
    format(error, vm, privateObject) {
        const [zeroLiteral, oneLiteral, newLineLiteral] = (() => {
            if (this.literalsCache == null) {
                const zeroOneNewLine = [
                    evalRbCode(vm, privateObject, "0"),
                    evalRbCode(vm, privateObject, "1"),
                    evalRbCode(vm, privateObject, `"\n"`),
                ];
                this.literalsCache = zeroOneNewLine;
                return zeroOneNewLine;
            }
            else {
                return this.literalsCache;
            }
        })();
        const backtrace = error.call("backtrace");
        if (backtrace.call("nil?").toString() === "true") {
            return this.formatString(error.call("class").toString(), error.toString());
        }
        const firstLine = backtrace.call("at", zeroLiteral);
        const restLines = backtrace
            .call("drop", oneLiteral)
            .call("join", newLineLiteral);
        return this.formatString(error.call("class").toString(), error.toString(), [
            firstLine.toString(),
            restLines.toString(),
        ]);
    }
    formatString(klass, message, backtrace) {
        if (backtrace) {
            return `${backtrace[0]}: ${message} (${klass})\n${backtrace[1]}`;
        }
        else {
            return `${klass}: ${message}`;
        }
    }
}
const checkStatusTag = (rawTag, vm, privateObject) => {
    switch (rawTag & ruby_tag_type.Mask) {
        case ruby_tag_type.None:
            break;
        case ruby_tag_type.Return:
            throw new RbError("unexpected return");
        case ruby_tag_type.Next:
            throw new RbError("unexpected next");
        case ruby_tag_type.Break:
            throw new RbError("unexpected break");
        case ruby_tag_type.Redo:
            throw new RbError("unexpected redo");
        case ruby_tag_type.Retry:
            throw new RbError("retry outside of rescue clause");
        case ruby_tag_type.Throw:
            throw new RbError("unexpected throw");
        case ruby_tag_type.Raise:
        case ruby_tag_type.Fatal:
            const error = new RbValue(vm.guest.rbErrinfo(), vm, privateObject);
            if (error.call("nil?").toString() === "true") {
                throw new RbError("no exception object");
            }
            // clear errinfo if got exception due to no rb_jump_tag
            vm.guest.rbClearErrinfo();
            throw new RbError(privateObject.exceptionFormatter.format(error, vm, privateObject));
        default:
            throw new RbError(`unknown error tag: ${rawTag}`);
    }
};
function wrapRbOperation(vm, body) {
    try {
        return body();
    }
    catch (e) {
        if (e instanceof RbError) {
            throw e;
        }
        // All JS exceptions triggered by Ruby code are translated to Ruby exceptions,
        // so non-RbError exceptions are unexpected.
        vm.guest.rbVmBugreport();
        if (e instanceof WebAssembly.RuntimeError && e.message === "unreachable") {
            const error = new RbError(`Something went wrong in Ruby VM: ${e}`);
            error.stack = e.stack;
            throw error;
        }
        else {
            throw e;
        }
    }
}
const callRbMethod = (vm, privateObject, recv, callee, args) => {
    const mid = vm.guest.rbIntern(callee + "\0");
    return wrapRbOperation(vm, () => {
        const [value, status] = vm.guest.rbFuncallvProtect(recv, mid, args);
        checkStatusTag(status, vm, privateObject);
        return value;
    });
};
const evalRbCode = (vm, privateObject, code) => {
    return wrapRbOperation(vm, () => {
        const [value, status] = vm.guest.rbEvalStringProtect(code + "\0");
        checkStatusTag(status, vm, privateObject);
        return new RbValue(value, vm, privateObject);
    });
};
/**
 * Error class thrown by Ruby execution
 */
class RbError extends Error {
    /**
     * @hideconstructor
     */
    constructor(message) {
        super(message);
    }
}

// vm constructor
// import {} from "geteventlisteners"

const consolePrinter = () => {
  let memory = undefined;
  let view = undefined;

  const decoder = new TextDecoder();

  return {
    addToImports(imports) {
      const original = imports.wasi_snapshot_preview1.fd_write;
      imports.wasi_snapshot_preview1.fd_write = (fd, iovs, iovsLen, nwritten) => {
        if (fd !== 1 && fd !== 2) {
          return original(fd, iovs, iovsLen, nwritten);
        }

        if (typeof memory === 'undefined' || typeof view === 'undefined') {
          throw new Error('Memory is not set');
        }
        if (view.buffer.byteLength === 0) {
          view = new DataView(memory.buffer);
        }

        const buffers = Array.from({ length: iovsLen }, (_, i) => {
          const ptr = iovs + i * 8;
          const buf = view.getUint32(ptr, true);
          const bufLen = view.getUint32(ptr + 4, true);
          return new Uint8Array(memory.buffer, buf, bufLen);
        });

        let written = 0;
        let str = '';
        for (const buffer of buffers) {
          str += decoder.decode(buffer);
          written += buffer.byteLength;
        }
        view.setUint32(nwritten, written, true);

        const log = fd === 1 ? console.log : console.warn;
        log(str);

        return 0;
      };
    },
    setMemory(m) {
      memory = m;
      view = new DataView(m.buffer);
    }
  }
};


const UnloosenVM = async (rubyModule) => {
    await n();

    const wasmFs = new sf();
    const wasi = new s({
      env: {
        "RUBY_FIBER_MACHINE_STACK_SIZE": String(1024 * 1024 * 20),
      },
      bindings: {fs: wasmFs.fs}
    });
    const vm = new RubyVM();

    const imports = wasi.getImports(rubyModule);
    vm.addToImports(imports);

    const printer = consolePrinter();
    printer?.addToImports(imports);


    const instance = await WebAssembly.instantiate(rubyModule, imports);
    wasi.instantiate(instance);
    await vm.setInstance(instance);

    printer?.setMemory(instance.exports.memory);

    instance.exports._initialize();
    vm.initialize();
    return {vm, wasi, instance}
};

const initVM = async(wasmUrl) => {
  const response = await fetch(wasmUrl);
  const buffer = await response.arrayBuffer();
  const module = await WebAssembly.compile(buffer);
  const { vm } = await UnloosenVM(module);

  return vm;
};

var VM;

const UnloosenVersion = "0.1.0";
const printInitMessage = () => {
    evalRubyCode(`
    puts <<~"INF"
        Unloosen Ruby Browser Extension by logiteca7/aaaa777
        Ruby version: #{RUBY_DESCRIPTION}
        Unloosen version: ${UnloosenVersion}
    INF
    `);
};

const buildExtensionURL = (filepath) => {
    return new URL(chrome.runtime.getURL(filepath));
};

// eval ruby script
const evalRubyCode = (code) => {
    VM.eval(code);
};

const evalRubyCodeAsync = async (code) => {
    await VM.evalAsync(code);
};

const evalRubyFromURL = async (url) => {
    await fetch(url)
        .then((response) => response.text())
        .then((text) => evalRubyCodeAsync(text));
};

// build chrome-extension:// url and eval ruby script
const evalRubyFromExtension = async (filepath) => {
    await evalRubyFromURL(buildExtensionURL(filepath));
};

const loadConfig = async (configKey, defaultVal) => {
    try {
        return await fetch(chrome.runtime.getURL("unloosen.config.json"))
        .then((response) => { 
            if(response.ok) {
                return response.json().then((json) => json[configKey] == undefined ? defaultVal : json[configKey]);
            } else {
                return defaultVal;
            } 
        });
    } catch {
        return defaultVal;
    }
};

const init = async () => {
    return initVM(buildExtensionURL(await loadConfig("ruby.wasm", "ruby.wasm")))
        .then(async (vm) => {
            VM = vm;
            return evalRubyCode('$:.unshift "/unloosen"');
        })
        .then(async (promise) => printInitMessage() || promise);
};

const main = async () => {
    await init();
    await evalRubyCode("module Unloosen; CURRENT_EVENT = :popup; end");
    
    await evalRubyCode("require 'require_remote'");
    if(await loadConfig("remote-require", true)) {
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('lib') +"')");
        await evalRubyCode("add_require_remote_uri('" + buildExtensionURL('') +"')");
    }
    await evalRubyFromExtension(await loadConfig("application", 'app.rb'));
};

main();
