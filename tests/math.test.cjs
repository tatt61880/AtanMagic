const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dataStr,
  parseData,
  createLines,
  sumAngles,
} = require('../src/math.js');

test('1～512を一度ずつ使った16×16の既約真分数', () => {
  const rows = parseData(dataStr);
  assert.equal(rows.length, 16);
  assert.ok(rows.every((row) => row.length === 16));
  const numbers = rows
    .flat()
    .flatMap(({ numer, denom }) => [numer, denom])
    .sort((a, b) => a - b);
  assert.deepEqual(
    numbers,
    Array.from({ length: 512 }, (_, i) => i + 1)
  );
});

test('重複・範囲外・非既約・不正なサイズを拒否する', () => {
  for (const bad of [
    dataStr.replace('5/168', '259/498'),
    dataStr.replace('5/168', '5/513'),
    dataStr.replace('5/168', '6/168'),
    dataStr.replace('5/168', '168/5'),
    dataStr.replace('5/168', '5/168/10'),
    dataStr.split('\n').slice(1).join('\n'),
  ])
    assert.throws(() => parseData(bad));
});

test('横16・縦16・対角線2本を正しい順序で選ぶ', () => {
  const rows = parseData(dataStr);
  const lines = createLines(rows);
  assert.equal(lines.length, 34);
  for (let i = 0; i < 16; i++) {
    assert.deepEqual(lines[i].fractions, rows[i]);
    assert.deepEqual(
      lines[16 + i].fractions,
      rows.map((row) => row[i])
    );
  }
  assert.deepEqual(
    lines[32].fractions,
    rows.map((row, i) => row[i])
  );
  assert.deepEqual(
    lines[33].fractions,
    rows.map((row, i) => row[15 - i])
  );
});

test('全34本で複素数積が正の実数となり、ちょうど1周する', () => {
  // 各因子 b + ai の偏角は0～π/4。BigIntで積を求め、正の実軸を
  // 下半平面から越える回数を数える。誤差なしで2πへの一致を確認する。
  for (const { label, fractions } of createLines(parseData(dataStr))) {
    let real = 1n;
    let imag = 0n;
    let turns = 0;
    for (const { numer, denom } of fractions) {
      const a = BigInt(numer);
      const b = BigInt(denom);
      const nextReal = real * b - imag * a;
      const nextImag = real * a + imag * b;
      if (imag < 0n && nextImag >= 0n && nextReal > 0n) turns++;
      [real, imag] = [nextReal, nextImag];
    }
    assert.equal(imag, 0n, label);
    assert.ok(real > 0n, label);
    assert.equal(turns, 1, label);
    assert.ok(Math.abs(sumAngles(fractions) - 2 * Math.PI) < 1e-12, label);
  }
});
