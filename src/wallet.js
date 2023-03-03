const axios = require('axios').default;
const { utils, Point } = require('@noble/secp256k1');
const dhke = require('./dhke');
const { splitAmount, bigIntStringify } = require('./utils');
const { uint8ToBase64 } = require('./base64');
const bolt11 = require('bolt11');
const bech32 = require('bech32');

// local storage for node
if (typeof localStorage === 'undefined' || localStorage === null) {
  var LocalStorage = require('node-localstorage').LocalStorage;
  localStorage = new LocalStorage('./scratch');
}

/**
 * @typedef {Object} Proof
 * @property {number} amount
 * @property {string} C
 * @property {string} id
 * @property {string} secret
 */

/**
 * @typedef {Object} SerializedBlindedSignature
 * @property {number} amount
 * @property {string} C_
 * @property {string} id
 */

/**
 * @typedef {Object} MintResponse
 * @property {SerializedBlindedSignature[]} promises -
 */

/**
 * @typedef {Object} ErrorResponse
 * @property {string} error -
 */

/**
 * @typedef {Object} RequestMintResponse
 * @property {string} pr -
 * @property {string} hash -
 */

/**
 * @typedef {Object} SplitProofs
 * @property {Proof[]} fristProofs
 * @property {Proof[]} scndProofs
 */

/**
 * @typedef {Object} KeysetResponse
 * @property {string[]} keysets -
 */

/**
 * Creates a new Wallet
 * @class
 */
class Wallet {
  /**
   * @constructs
   * @param {string} [mintUrl] URL of the mint
   */
  constructor(mintUrl = null) {
    this.proofs = JSON.parse(localStorage.getItem('proofs') || '[]');

    if (mintUrl == null) {
      this.mintUrl = MINT_SERVER;
    } else {
      this.mintUrl = mintUrl;
    }
  }

  // --------- GET /keys
  /**
   * Gets public keys of the mint
   */
  async loadMint() {
    this.keys = await this.getKeysApi();
    this.keysets = await this.getKeysetsApi();
    this.mints = [{ url: this.mintUrl, keysets: this.keysets }];
  }

  /**
   * @returns {Object<string, string>}
   */
  async getKeysApi() {
    const { data } = await axios.get(`${this.mintUrl}/keys`);
    return data;
  }

  /**
   *
   * @returns {KeysetResponse}
   */
  async getKeysetsApi() {
    const { data } = await axios.get(`${this.mintUrl}/keysets`);
    return data.keysets;
  }
  // --------- POST /mint

  /*
  
  Mint new tokens by providing a payment hash corresponding to a paid Lightning invoice. 

  The wallet provides an array of `outputs` (aka blinded secrets) which are to be signed by the mint.
  The mint then responds with these `promises` (aka blinded signatures). 
  The wallet then unblinds these and stores them as `proofs`, which are the tuple (secret, signature). 
  
  */

  /**
   *
   * @param {number[]} amounts
   * @param {string} [paymentHash]
   * @returns {Proof[]}
   */
  async mintApi(amounts, paymentHash = '') {
    let secrets = await this.generateSecrets(amounts);
    let { outputs, rs } = await this.constructOutputs(amounts, secrets);
    let postMintRequest = { outputs: outputs };
    const postMintResponse = await axios.post(
      `${this.mintUrl}/mint`,
      postMintRequest,
      {
        params: {
          payment_hash: paymentHash,
        },
      }
    );
    this.assertMintError(postMintResponse);
    let proofs = await this.constructProofs(
      postMintResponse.data.promises,
      secrets,
      rs
    );
    return proofs;
  }

  /**
   * @param {number} amount
   * @param {string} hash
   * @returns {Promise<Proof[]>}
   */
  async mint(amount, hash) {
    try {
      const amounts = splitAmount(amount);
      const proofs = await this.mintApi(amounts, hash);
      this.proofs = this.proofs.concat(proofs);
      this.storeProofs();
      return proofs;
    } catch (error) {
      console.log("Failed to execute 'mint' command");
      console.error(error);
    }
  }

  // --------- GET /mint

  /* Request to mint new tokens of a given amount. Mint will return a Lightning invoice that the user has to pay. */

  /**
   * @param {number} amount
   * @returns {Promise<RequestMintResponse | ErrorResponse>}
   */
  async requestMintApi(amount) {
    const getMintResponse = await axios.get(`${this.mintUrl}/mint`, {
      params: {
        amount: amount,
      },
    });
    this.assertMintError(getMintResponse);
    return getMintResponse.data;
  }

  /**
   * @param {number} amount
   * @returns {Promise<RequestMintResponse>}
   */
  async requestMint(amount) {
    try {
      const invoice = await this.requestMintApi(amount);
      return invoice;
    } catch (error) {
      console.log("Failed to execute 'mint' command");
      console.error(error);
    }
  }

  // --------- POST /split
  /**
   *
   * @param {Proof[]} proofs
   * @param {number} amount
   * @returns
   */
  async splitApi(proofs, amount) {
    try {
      const total = this.sumProofs(proofs);
      const frst_amount = total - amount;
      const scnd_amount = amount;
      const frst_amounts = splitAmount(frst_amount);
      const scnd_amounts = splitAmount(scnd_amount);
      const amounts = [...frst_amounts];
      amounts.push(...scnd_amounts);
      let secrets = await this.generateSecrets(amounts);
      if (secrets.length != amounts.length) {
        throw new Error('number of secrets does not match number of outputs.');
      }
      let { outputs, rs } = await this.constructOutputs(amounts, secrets);
      const postSplitRequest = {
        amount: amount,
        proofs: proofs,
        outputs: outputs,
      };

      const postSplitResponse = await axios.post(
        `${this.mintUrl}/split`,
        postSplitRequest
      );
      this.assertMintError(postSplitResponse);
      const frst_rs = rs.slice(0, frst_amounts.length);
      const frst_secrets = secrets.slice(0, frst_amounts.length);
      const scnd_rs = rs.slice(frst_amounts.length);
      const scnd_secrets = secrets.slice(frst_amounts.length);
      const fristProofs = this.constructProofs(
        postSplitResponse.data.fst,
        frst_secrets,
        frst_rs
      );
      const scndProofs = this.constructProofs(
        postSplitResponse.data.snd,
        scnd_secrets,
        scnd_rs
      );

      return { fristProofs, scndProofs };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * supplies proofs and requests a split from the mint of these
        proofs at a specific amount
   * @param {Proof[]} proofs 
   * @param {number} amount 
   * @returns {Promise<SplitProofs>}
   */
  async split(proofs, amount) {
    try {
      if (proofs.length == 0) {
        throw new Error('no proofs provided.');
      }
      let { fristProofs, scndProofs } = await this.splitApi(proofs, amount);
      this.deleteProofs(proofs);
      // add new fristProofs, scndProofs to this.proofs
      this.proofs = this.proofs.concat(fristProofs).concat(scndProofs);
      this.storeProofs();
      return { fristProofs, scndProofs };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /**
   * splits proofs so the user can keep firstProofs, send scndProofs.
   * then sets scndProofs as reserved.
   *
   * if invalidate, scndProofs (the one to send) are invalidated
   * @param {Proof[]} proofs
   * @param {number} amount
   * @param {boolean} [invlalidate]
   * @returns {Promise<SplitProofs>}
   */
  async splitToSend(proofs, amount, invlalidate = false) {
    try {
      const spendableProofs = proofs.filter((p) => !p.reserved);
      if (this.sumProofs(spendableProofs) < amount) {
        throw Error('balance too low.');
      }

      // call /split
      let { fristProofs, scndProofs } = await this.split(
        spendableProofs,
        amount
      );
      // set scndProofs in this.proofs as reserved
      const usedSecrets = proofs.map((p) => p.secret);
      for (let i = 0; i < this.proofs.length; i++) {
        if (usedSecrets.includes(this.proofs[i].secret)) {
          this.proofs[i].reserved = true;
        }
      }
      if (invlalidate) {
        // delete scndProofs from db
        this.deleteProofs(scndProofs);
      }

      return { fristProofs, scndProofs };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  async redeem(proofs) {
    /*
    Uses the /split endpoint to receive new tokens.
    */
    try {
      const amount = proofs.reduce((s, t) => (s += t.amount), 0);
      await this.split(proofs, amount);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // --------- POST /melt

  async melt(invoice) {
    try {
      const amount_invoice = bolt11.decode(invoice).millisatoshis / 1000;
      const amount = amount_invoice + (await this.checkFees(invoice));

      let { _, scndProofs } = await this.splitToSend(this.proofs, amount);
      const postMeltRequest = {
        proofs: scndProofs.flat(),
        amount: amount,
        pr: invoice,
      };

      const postMeltResponse = await axios.post(
        `${this.mintUrl}/melt`,
        postMeltRequest
      );
      this.assertMintError(postMeltResponse);
      if (postMeltResponse.data.paid) {
        this.deleteProofs(scndProofs);
      }
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // --------- GET /check

  async checkSpendable(proofs) {
    const checkSpendableRequest = {
      proofs: proofs,
    };
    try {
      const checkSpendableResponse = await axios.post(
        `${this.mintUrl}/check`,
        checkSpendableRequest
      );
      this.assertMintError(checkSpendableResponse);
      let spentProofs = proofs.filter(
        (p, pidx) => !checkSpendableResponse.data.spendable[pidx]
      );
      var spendable = true;
      if (spentProofs.length) {
        this.deleteProofs(spentProofs);
        spendable = false;
      }
      return spendable;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // --------- GET /checkfees

  async checkFees(invoice) {
    const getCheckFeesRequest = {
      pr: invoice,
    };
    try {
      const checkFeesResponse = await axios.post(
        `${this.mintUrl}/checkfees`,
        getCheckFeesRequest
      );
      this.assertMintError(checkFeesResponse);
      return checkFeesResponse.data.fee;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  // --------- crypto

  generateSecrets(amounts) {
    const secrets = [];
    for (let i = 0; i < amounts.length; i++) {
      const secret = utils.randomBytes(32);
      secrets.push(secret);
    }
    return secrets;
  }

  async constructOutputs(amounts, secrets) {
    const outputs = [];
    const rs = [];
    for (let i = 0; i < amounts.length; i++) {
      const { B_, r } = await dhke.step1Alice(secrets[i]);
      outputs.push({ amount: amounts[i], B_: B_ });
      rs.push(r);
    }
    return {
      outputs,
      rs,
    };
  }

  constructProofs(promises, secrets, rs) {
    const proofs = [];
    for (let i = 0; i < promises.length; i++) {
      const encodedSecret = uint8ToBase64.encode(secrets[i]);
      let { id, amount, C, secret } = this.promiseToProof(
        promises[i].id,
        promises[i].amount,
        promises[i]['C_'],
        encodedSecret,
        rs[i]
      );
      proofs.push({ id, amount, C, secret });
    }
    return proofs;
  }

  promiseToProof(id, amount, C_hex, secret, r) {
    const C_ = Point.fromHex(C_hex);
    const A = this.keys[amount];
    const C = dhke.step3Alice(C_, utils.hexToBytes(r), Point.fromHex(A));
    return {
      id,
      amount,
      C: C.toHex(true),
      secret,
    };
  }

  // --------- utils

  decodeInvoice(invoice) {
    return bolt11.decode(invoice);
  }

  sumProofs(proofs) {
    return proofs.reduce((s, t) => (s += t.amount), 0);
  }

  serializeProofs(proofs) {
    // unique keyset IDs of proofs
    var uniqueIds = [...new Set(proofs.map((p) => p.id))];
    // mints that have any of the keyset IDs
    var mints_keysets = this.mints.filter((m) =>
      m.keysets.some((r) => uniqueIds.indexOf(r) >= 0)
    );
    // what we put into the JSON
    var mints = mints_keysets.map((m) => [{ url: m.url, ids: m.keysets }][0]);
    var token = {
      proofs: proofs,
      mints,
    };
    return btoa(JSON.stringify(token));
  }

  // lnurlpay

  async lnurlPay(address, amount) {
    if (
      (address.split('@').length != 2 ||
        address.toLowerCase().slice(0, 6) != 'lnurl1') &&
      !(amount > 0)
    ) {
      throw Error('wrong input.');
    }

    if (address.split('@').length == 2) {
      let [user, host] = address.split('@');
      var { data } = await axios.get(
        `https://${host}/.well-known/lnurlp/${user}`
      );
    } else if (address.toLowerCase().slice(0, 6) === 'lnurl1') {
      let host = Buffer.from(
        bech32.fromWords(bech32.decode(address, 20000).words)
      ).toString();
      var { data } = await axios.get(host);
    }

    if (
      data.tag == 'payRequest' &&
      data.minSendable <= amount * 1000 <= data.maxSendable
    ) {
      var { data } = await axios.get(
        `${data.callback}?amount=${amount * 1000}`
      );
      console.log(data.pr);
      return data.pr;
    }
  }

  // local storage

  storeProofs() {
    localStorage.setItem(
      'proofs',
      JSON.stringify(this.proofs, bigIntStringify)
    );
  }

  deleteProofs(proofs) {
    // delete proofs from this.proofs
    const usedSecrets = proofs.map((p) => p.secret);
    this.proofs = this.proofs.filter((p) => !usedSecrets.includes(p.secret));
    this.storeProofs();
    return this.proofs;
  }

  // error checking from mint

  assertMintError(resp) {
    if (resp.data.hasOwnProperty('error')) {
      const e = `Mint error (code ${resp.data.code}): ${resp.data.error}`;
      throw new Error(e);
    }
  }
}

if (module && module.exports) {
  module.exports.Wallet = Wallet;
}
try {
  window.Wallet = Wallet;
} catch (error) {}
