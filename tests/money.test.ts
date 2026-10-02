import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Money } from "../src/lib/money";

describe("Money Utility & Decimal Arithmetic", () => {
  test("strictly prevents IEEE 754 floating point drift (0.1 + 0.2 === 0.3)", () => {
    const a = Money.of(0.1);
    const b = Money.of(0.2);
    const sum = a.add(b);

    assert.equal(sum.toDecimalString(), "0.30");
    assert.equal(sum.toPaise(), 30);
  });

  test("performs accurate addition and subtraction on business amounts", () => {
    const income = Money.of("485000.00");
    const expense = Money.of("215000.00");
    const net = income.subtract(expense);

    assert.equal(net.toDecimalString(), "270000.00");
    assert.equal(net.isPositive(), true);
  });

  test("formats accurately using Indian numbering system (Lakhs & Crores)", () => {
    const small = Money.of(25000);
    const large = Money.of(12500000); // 1 Crore 25 Lakhs

    assert.equal(small.format(), "₹25,000.00");
    assert.equal(large.format({ showDecimals: false }), "₹1,25,00,000");
  });

  test("safely parses messy formatted inputs", () => {
    const m1 = Money.parse("₹ 1,25,000.50");
    const m2 = Money.parse("25,000");
    const m3 = Money.parse(null);
    const m4 = Money.parse("");

    assert.equal(m1.toDecimalString(), "125000.50");
    assert.equal(m2.toDecimalString(), "25000.00");
    assert.equal(m3.toDecimalString(), "0.00");
    assert.equal(m4.toDecimalString(), "0.00");
  });

  test("handles comparison logic correctly", () => {
    const a = Money.of("100.00");
    const b = Money.of("200.00");
    const c = Money.of("100.00");

    assert.equal(a.lessThan(b), true);
    assert.equal(b.greaterThan(a), true);
    assert.equal(a.equals(c), true);
  });
});
