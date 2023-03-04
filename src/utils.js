const { utils } = require('@noble/secp256k1');

/**
 * Split an amount into chunks
 * @param {number} value Amount to be split
 * @returns {number[]}
 */
function splitAmount(value) {
  const chunks = [];
  for (let i = 0; i < 32; i++) {
    const mask = 1 << i;
    if ((value & mask) !== 0) chunks.push(Math.pow(2, i));
  }
  return chunks;
}

/**
 * Convert an Uint8Array into a big integer
 * @param {Uint8Array} bytes
 * @returns {BigInt}
 */
function bytesToNumber(bytes) {
  return hexToNumber(utils.bytesToHex(bytes));
}

/**
 * Replacer function used in JSON.stringify to convert big integers in an array to string for saving to localStorage
 * @param {any} _key Unused
 * @param {any} value
 * @returns {string}
 */
function bigIntStringify(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

/**
 * Convert a hex string to a Big Int
 * @param {string} hex
 * @returns {BigInt}
 */
function hexToNumber(hex) {
  if (typeof hex !== 'string') {
    throw new TypeError('hexToNumber: expected string, got ' + typeof hex);
  }
  return BigInt(`0x${hex}`);
}

module.exports = {
  splitAmount,
  bytesToNumber,
  hexToNumber,
  bigIntStringify,
};
