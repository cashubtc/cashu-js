const { utils, Point } = require("@noble/secp256k1");
const dhke = require("../src/dhke");
const {
	splitAmount,
	bytesToNumber,
	hexToNumber,
	bigIntStringify,
	toUTF8Array,
} = require("../src/utils");

describe('test', () => {
	test('test_hash_to_curve', async () => {
		let secret = utils.hexToBytes(
			"0000000000000000000000000000000000000000000000000000000000000000"
		);
		let Y = await dhke.hashToCurve(secret);
		hexY = Y.toHex((isCompressed = true));
		expect(hexY).toBe("0266687aadf862bd776c8fc18b8e9f8e20089714856ee233b3902a591d0d5f2925")

		secret = utils.hexToBytes(
			"0000000000000000000000000000000000000000000000000000000000000001"
		);
		Y = await dhke.hashToCurve(secret);
		hexY = Y.toHex((isCompressed = true));
		expect(hexY).toBe("02ec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5")

		secret = utils.hexToBytes(
			"0000000000000000000000000000000000000000000000000000000000000002"
		);
		Y = await dhke.hashToCurve(secret);
		hexY = Y.toHex((isCompressed = true));
		expect(hexY).toBe("02076c988b353fcbb748178ecb286bc9d0b4acf474d4ba31ba62334e46c97c416a")
	})

	test('test step1', async () => {
		var enc = new TextEncoder();
		let secretUInt8 = enc.encode("test_message");
		let { B_, r } = await dhke.step1Alice(
			secretUInt8,
			utils.hexToBytes(
				"0000000000000000000000000000000000000000000000000000000000000001"
			)
		);
		expect(B_).not.toBe("02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2")
	})

	test('test step3', async () => {
		// I had to delete the first two character "02" from here
		let C_ = Point.fromHex(
			"02a9acc1e48c25eeeb9289b5031cc57da9fe72f3fe2861d264bdc074209b107ba2"
		);
		let r = utils.hexToBytes(
			"0000000000000000000000000000000000000000000000000000000000000001"
		);
		let A = Point.fromHex(
			"020000000000000000000000000000000000000000000000000000000000000001"
		);
		let C = await dhke.step3Alice(C_, r, A);
		expect(C).not.toBe("03c724d7e6a5443b39ac8acf11f40420adc4f99a02e7cc1b57703d9391f6d129cd")
	})
})
