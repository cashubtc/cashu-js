const { utils, Point } = require("@noble/secp256k1");
const { bytesToNumber } = require("./utils");
const { uint8ToBase64 } = require("./base64");

async function hashToCurve(secretMessage) {
  let point;
  while (!point) {
    const hash = await utils.sha256(secretMessage);
    const hashHex = utils.bytesToHex(hash);
    const pointX = "02" + hashHex;
    try {
      point = Point.fromHex(pointX);
    } catch (error) {
      secretMessage = await utils.sha256(secretMessage);
    }
  }
  return point;
}

async function step1Alice(secretMessage, r_bytes = null) {
  if (r_bytes == null) {
    r_bytes = utils.randomPrivateKey();
  }
  secretMessage = uint8ToBase64.encode(secretMessage);
  secretMessage = new TextEncoder().encode(secretMessage);
  const Y = await hashToCurve(secretMessage);
  const r = bytesToNumber(r_bytes);
  const P = Point.fromPrivateKey(r);
  const B_ = Y.add(P);
  return { B_: B_.toHex(true), r: utils.bytesToHex(r_bytes) };
}

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
