"use client";

import React, { useState } from "react";
import { formatINR } from "@/lib/formatters";

interface CurrencyInputProps {
  id?: string;
  name: string;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  onChange?: (val: string) => void;
}

export function CurrencyInput({
  id,
  name,
  value,
  defaultValue = "",
  placeholder = "0.00",
  required = false,
  disabled = false,
  className = "",
  onChange,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => {
    const initial = value !== undefined ? value : defaultValue;
    if (initial === "" || initial === undefined || initial === null) return "";
    const num = Number(initial);
    return isNaN(num) ? "" : formatINR(num);
  });

  const [rawValue, setRawValue] = useState<string>(() => {
    const initial = value !== undefined ? value : defaultValue;
    return initial !== undefined && initial !== null ? initial.toString() : "";
  });

  const [prevValue, setPrevValue] = useState(value);
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
    setRawValue(value.toString());
    const num = Number(value);
    setDisplayValue(isNaN(num) || value === "" ? "" : formatINR(num));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep only numbers and a single decimal point
    const raw = e.target.value.replace(/[^0-9.]/g, "");
    const parts = raw.split(".");
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;

    setRawValue(sanitized);
    setDisplayValue(e.target.value);

    if (onChange) {
      onChange(sanitized);
    }
  };

  const handleBlur = () => {
    if (!rawValue || rawValue.trim() === "") {
      setDisplayValue("");
      return;
    }
    const num = parseFloat(rawValue);
    if (!isNaN(num)) {
      setDisplayValue(formatINR(num));
    }
  };

  const handleFocus = () => {
    setDisplayValue(rawValue);
  };

  return (
    <div className="relative rounded-xl shadow-sm">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-semibold text-sm">
        ₹
      </div>
      <input
        type="text"
        inputMode="decimal"
        id={id}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={`w-full rounded-xl bg-slate-900/90 border border-slate-700/80 pl-8 pr-4 py-2.5 text-sm font-semibold text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all ${className}`}
      />
      {/* Hidden input to pass clean numeric value through Form submit */}
      <input type="hidden" name={name} value={rawValue} />
    </div>
  );
}
