import Decimal from "decimal.js";

// Configure Decimal globally for accounting safety
Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -7,
  toExpPos: 21,
});

export interface MoneyFormatOptions {
  showSymbol?: boolean;
  showDecimals?: boolean;
}

/**
 * Enterprise Accounting Money Class.
 * Ensures 100% decimal precision using Decimal.js.
 * Strictly prevents floating-point drift (e.g. 0.1 + 0.2 !== 0.3).
 */
export class Money {
  private readonly value: Decimal;
  public readonly currency: string;

  constructor(amount: Decimal.Value, currency = "INR") {
    this.currency = currency;
    try {
      this.value = new Decimal(amount);
    } catch {
      this.value = new Decimal(0);
    }
  }

  /**
   * Factory constructor from string, number, or Decimal
   */
  public static of(amount: Decimal.Value, currency = "INR"): Money {
    return new Money(amount, currency);
  }

  /**
   * Factory constructor from integer Paise (1 INR = 100 Paise)
   */
  public static fromPaise(paise: number | bigint, currency = "INR"): Money {
    const amount = new Decimal(paise.toString()).dividedBy(100);
    return new Money(amount, currency);
  }

  /**
   * Zero Money instance
   */
  public static zero(currency = "INR"): Money {
    return new Money(0, currency);
  }

  /**
   * Factory constructor from Prisma or Decimal.js Decimal value
   */
  public static fromDecimal(decimal: Decimal.Value | null | undefined, currency = "INR"): Money {
    if (decimal === null || decimal === undefined) {
      return Money.zero(currency);
    }
    return new Money(decimal, currency);
  }

  /**
   * Safe parser that cleans formatted currency strings (e.g. "₹ 1,25,000.50" -> 125000.50)
   */
  public static parse(input: string | number | null | undefined, currency = "INR"): Money {
    if (input === null || input === undefined || input === "") {
      return Money.zero(currency);
    }
    if (typeof input === "number") {
      return new Money(input, currency);
    }
    // Remove currency symbols, commas, spaces
    const cleaned = input.replace(/[^0-9.-]+/g, "");
    if (!cleaned || cleaned === "-" || cleaned === ".") {
      return Money.zero(currency);
    }
    return new Money(cleaned, currency);
  }

  /**
   * Addition: this + other
   */
  public add(other: Money | Decimal.Value): Money {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.plus(otherVal), this.currency);
  }

  public plus(other: Money | Decimal.Value): Money {
    return this.add(other);
  }

  /**
   * Subtraction: this - other
   */
  public subtract(other: Money | Decimal.Value): Money {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return new Money(this.value.minus(otherVal), this.currency);
  }

  public minus(other: Money | Decimal.Value): Money {
    return this.subtract(other);
  }

  /**
   * Absolute value: |this|
   */
  public abs(): Money {
    return new Money(this.value.abs(), this.currency);
  }

  /**
   * Multiplication: this * factor
   */
  public multiply(factor: Decimal.Value): Money {
    return new Money(this.value.times(new Decimal(factor)), this.currency);
  }

  /**
   * Division: this / divisor
   */
  public divide(divisor: Decimal.Value): Money {
    const d = new Decimal(divisor);
    if (d.isZero()) {
      throw new Error("Division by zero in Money calculation");
    }
    return new Money(this.value.dividedBy(d), this.currency);
  }

  /**
   * Comparison: this == other
   */
  public equals(other: Money | Decimal.Value): boolean {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return this.value.equals(otherVal);
  }

  /**
   * Comparison: this > other
   */
  public greaterThan(other: Money | Decimal.Value): boolean {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return this.value.greaterThan(otherVal);
  }

  /**
   * Comparison: this >= other
   */
  public greaterThanOrEqual(other: Money | Decimal.Value): boolean {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return this.value.greaterThanOrEqualTo(otherVal);
  }

  /**
   * Comparison: this < other
   */
  public lessThan(other: Money | Decimal.Value): boolean {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return this.value.lessThan(otherVal);
  }

  /**
   * Comparison: this <= other
   */
  public lessThanOrEqual(other: Money | Decimal.Value): boolean {
    const otherVal = other instanceof Money ? other.value : new Decimal(other);
    return this.value.lessThanOrEqualTo(otherVal);
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public isPositive(): boolean {
    return this.value.isPositive() && !this.value.isZero();
  }

  public isNegative(): boolean {
    return this.value.isNegative();
  }

  /**
   * Returns exact decimal string with 2 decimal places (e.g. "25000.00")
   */
  public toDecimalString(): string {
    return this.value.toFixed(2);
  }

  /**
   * Returns total integer Paise (e.g. 25000.50 -> 2500050)
   */
  public toPaise(): number {
    return this.value.times(100).round().toNumber();
  }

  /**
   * Returns underlying Decimal.js instance
   */
  public getDecimal(): Decimal {
    return this.value;
  }

  public toDecimal(): Decimal {
    return this.value;
  }

  /**
   * Returns numeric float for graphing/charting purposes only
   */
  public toNumber(): number {
    return this.value.toNumber();
  }

  /**
   * Returns standard Indian Rupee format (e.g. "₹1,25,000.00" or "₹25,000")
   */
  public format(options: MoneyFormatOptions = {}): string {
    const { showSymbol = true, showDecimals = true } = options;
    const num = this.value.toNumber();

    const formatted = new Intl.NumberFormat("en-IN", {
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(num);

    return showSymbol ? `₹${formatted}` : formatted;
  }

  public toString(): string {
    return this.format();
  }

  public toJSON(): string {
    return this.toDecimalString();
  }
}
