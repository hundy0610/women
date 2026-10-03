import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../public/shared/config.mjs';
import { quote } from '../public/shared/pricing.mjs';

const q = (spaceIds, startHour, endHour, people = 1) => quote(CONFIG, { spaceIds, startHour, endHour, people });
const ALL = ['lobby', 'seminar', 'room1', 'room2', 'room3'];

test('시간당 요금', () => {
  assert.equal(q(['lobby'], 10, 12).total, 60000);
  assert.equal(q(['seminar'], 10, 15).total, 150000);
  assert.equal(q(['room1'], 10, 13).total, 60000);
});

test('8시간은 1일 요금', () => {
  assert.equal(q(['lobby'], 9, 17).total, 200000);
  assert.equal(q(['seminar'], 9, 17).total, 200000);
  assert.equal(q(['room1'], 9, 17).total, 130000);
});

test('7시간도 1일 요금을 넘지 않는다', () => {
  assert.equal(q(['lobby'], 9, 16).total, 200000);
  assert.equal(q(['room1'], 9, 16).total, 130000);
  assert.equal(q(['room1'], 9, 15).total, 120000); // 6시간은 시간당 계산
});

test('8시간 초과는 1일 요금에 남은 시간을 더한다', () => {
  assert.equal(q(['lobby'], 9, 21).total, 200000 + 120000);
});

test('조합: 세미나실 + 방1 하루 = 330,000', () => {
  assert.equal(q(['seminar', 'room1'], 9, 17).total, 330000);
});

test('전체 패키지 8시간 = 700,000, 개별 합계는 790,000', () => {
  const r = q(ALL, 9, 17);
  assert.equal(r.isPackage, true);
  assert.equal(r.subtotal, 790000);
  assert.equal(r.packageDiscount, 90000);
  assert.equal(r.total, 700000);
});

test('전체 패키지 짧은 시간은 시간당 합계, 1일 요금 이상이면 700,000', () => {
  assert.equal(q(ALL, 9, 14).total, 600000); // 5시간 120,000 x 5
  assert.equal(q(ALL, 9, 15).total, 700000); // 6시간 720,000 -> 상한
  assert.equal(q(ALL, 9, 21).total, 700000 + 480000);
});

test('최대 인원 초과 1인당 10,000원', () => {
  const r = q(['lobby'], 9, 17, 55);
  assert.equal(r.extraPeople, 5);
  assert.equal(r.overageFee, 50000);
  assert.equal(r.total, 250000);
  assert.equal(q(['lobby'], 9, 17, 50).overageFee, 0);
  assert.equal(q(['lobby', 'seminar'], 9, 17, 111).extraPeople, 1);
});

test('잘못된 입력', () => {
  assert.equal(q(['lobby'], 10, 11).ok, false);
  assert.equal(q(['lobby'], 8, 12).ok, false);
  assert.equal(q(['lobby'], 12, 22).ok, false);
  assert.equal(q([], 10, 12).ok, false);
  assert.equal(q(['nope'], 10, 12).ok, false);
});
