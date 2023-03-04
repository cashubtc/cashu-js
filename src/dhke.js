const { utils, Point } = require('@noble/secp256k1');
const { bytesToNumber } = require('./utils');

/**
 * Keep hashing a secret message until it is a point on the EC
 * @param {Uint8Array} secretMessage
 * @returns {Promise<Point>} returns a Point on secp256k1
 */
async function hashToCurve(secretMessage) {
  let point;
  while (!point) {
    const hash = await utils.sha256(secretMessage);
    const hashHex = utils.bytesToHex(hash);
    const pointX = '02' + hashHex;
    try {
      point = Point.fromHex(pointX);
    } catch (error) {
      secretMessage = await utils.sha256(secretMessage);
    }
  }
  return point;
}

/**
 * @typedef {Object} Step1Response
 * @property {string} B_ - Hex string of the point
 * @property {string} r - Hex value of r_bytes
 */

/**
 * @param {Uint8Array} secretMessage
 * @param {Uint8Array} [r_bytes]
 * @returns {promise<Step1Response>} resolves { B_: <hex string>, r: <hex string>}
 */
async function step1Alice(secretMessage, r_bytes = null) {
  if (r_bytes == null) {
    r_bytes = utils.randomPrivateKey();
  }
  const Y = await hashToCurve(secretMessage);
  const P = Point.fromPrivateKey(r_bytes);
  const B_ = Y.add(P);
  return { B_: B_.toHex(true), r: utils.bytesToHex(r_bytes) };
}

/**
 *
 * @param {Uint8Array} C_
 * @param {Uint8Array} r
 * @param {Uint8Array} A
 * @returns {Uint8Array}
 */
function step3Alice(C_, r, A) {
  const rInt = bytesToNumber(r);
  const C = C_.subtract(A.multiply(rInt));
  return C;
}

module.exports = {
  hashToCurve,
  step1Alice,
  step3Alice,
};
