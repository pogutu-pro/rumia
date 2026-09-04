'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export interface OTPInputProps {
  length?: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  error?: boolean;
  ariaLabel?: string;
  autoFocus?: boolean;
  inputClassName?: string;
}

const DIGIT_REGEX = /^[0-9]$/;
const sanitize = (v?: string): string =>
  typeof v === 'string' ? v.replace(/\D/g, '') : '';

/** Main OTP component */
export function OTPInput({
  length = 6,
  value,
  defaultValue,
  onChange,
  onComplete,
  disabled = false,
  error = false,
  ariaLabel = 'One-time password input',
  autoFocus = false,
  inputClassName,
}: OTPInputProps) {
  const isControlled = typeof value === 'string';

  const [internal, setInternal] = React.useState(() =>
    sanitize(defaultValue).slice(0, length),
  );

  const current = React.useMemo(
    () => sanitize(isControlled ? value : internal).slice(0, length),
    [isControlled, value, internal, length],
  );

  const refs = React.useRef<HTMLInputElement[]>([]);

  React.useEffect(() => {
    refs.current = refs.current.slice(0, length);
  }, [length]);

  const slots = React.useMemo(() => Array.from({ length }), [length]);

  const setValue = React.useCallback(
    (next: string) => {
      const trimmed = sanitize(next).slice(0, length);

      if (!isControlled) setInternal(trimmed);
      onChange?.(trimmed);

      if (trimmed.length === length && !trimmed.includes('')) {
        onComplete?.(trimmed);
      }
    },
    [isControlled, length, onChange, onComplete],
  );

  const focusAt = React.useCallback(
    (index: number) => {
      if (disabled) return;
      const el = refs.current[index];
      if (el) {
        el.focus();
        el.select();
      }
    },
    [disabled],
  );

  const focusNext = React.useCallback(
    (index: number) => focusAt(Math.min(length - 1, index + 1)),
    [focusAt, length],
  );

  const focusPrev = React.useCallback(
    (index: number) => focusAt(Math.max(0, index - 1)),
    [focusAt],
  );

  React.useEffect(() => {
    if (autoFocus && !disabled) {
      const firstEmpty = Math.min(current.length, length - 1);
      requestAnimationFrame(() => focusAt(firstEmpty));
    }
  }, [autoFocus, disabled, current.length, focusAt, length]);

  const handleChange = React.useCallback(
    (index: number, raw: string) => {
      if (disabled) return;

      const char = raw.slice(-1);

      if (!char) {
        const arr = current.split('');
        arr[index] = '';
        setValue(arr.join(''));
        return;
      }

      if (!DIGIT_REGEX.test(char)) return;

      const arr = Array.from({ length }, (_, i) => current[i] ?? '');
      arr[index] = char;
      const joined = arr.join('');

      setValue(joined);

      if (index < length - 1) focusNext(index);
    },
    [current, disabled, focusNext, length, setValue],
  );

  const handleKeyDown = React.useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      const arr = Array.from({ length }, (_, i) => current[i] ?? '');
      const key = e.key;

      switch (key) {
        case 'Backspace':
          e.preventDefault();
          if (arr[index]) {
            arr[index] = '';
            setValue(arr.join(''));
            focusAt(index);
          } else if (index > 0) {
            arr[index - 1] = '';
            setValue(arr.join(''));
            focusPrev(index);
          }
          return;

        case 'Delete':
          e.preventDefault();
          arr[index] = '';
          setValue(arr.join(''));
          focusAt(index);
          return;

        case 'ArrowLeft':
          e.preventDefault();
          if (index > 0) focusPrev(index);
          return;

        case 'ArrowRight':
          e.preventDefault();
          if (index < length - 1) focusNext(index);
          return;

        case 'Home':
          e.preventDefault();
          focusAt(0);
          return;

        case 'End':
          e.preventDefault();
          focusAt(length - 1);
          return;
      }
    },
    [current, disabled, focusAt, focusNext, focusPrev, length, setValue],
  );

  const handlePaste = React.useCallback(
    (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.preventDefault();

      const pasted = sanitize(e.clipboardData.getData('text')).slice(
        0,
        length - index,
      );
      if (!pasted) return;

      const arr = Array.from({ length }, (_, i) => current[i] ?? '');

      for (let i = 0; i < pasted.length; i++) {
        arr[index + i] = pasted[i];
      }

      const joined = arr.join('');
      setValue(joined);

      const lastIndex = Math.min(index + pasted.length - 1, length - 1);
      focusAt(lastIndex);
    },
    [current, disabled, focusAt, length, setValue],
  );

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex justify-center gap-2"
    >
      {slots.map((_, i) => {
        const digit = current[i] ?? '';

        return (
          <input
            key={i}
            ref={(el) => {
              if (el) refs.current[i] = el;
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            aria-invalid={error || undefined}
            aria-label={`Digit ${i + 1}`}
            maxLength={1}
            disabled={disabled}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => handlePaste(i, e)}
            className={cn(
              'w-12 h-14 rounded-lg border-2 bg-white text-center text-2xl font-semibold transition-all',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              error
                ? 'border-[--rumi-danger,#f87171] focus-visible:ring-[--rumi-danger,#f87171]'
                : 'border-[--rumi-border,#e5e7eb] focus-visible:ring-[--rumi-accent,#34d399]',
              disabled &&
                'cursor-not-allowed bg-[--rumi-disabled,#f3f4f6] opacity-60',
              digit && !error
                ? 'border-[--rumi-accent,#34d399] bg-[--rumi-accent-bg,#ecfdf5]'
                : '',
              inputClassName,
            )}
          />
        );
      })}
    </div>
  );
}

export default OTPInput;
