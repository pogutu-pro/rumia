'use client';

import * as React from 'react';
import {
  useFormContext,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form';
import CurrencyInput from 'react-currency-input-field';
import { FieldWrapper } from '@/components/ui/form-fields';
import { cn } from '@/lib/utils/cn';

interface CurrencyInputFieldProps<TFieldValues extends FieldValues>
  extends Omit<
    React.ComponentPropsWithoutRef<typeof CurrencyInput>,
    'name' | 'onChange' | 'value' | 'id'
  > {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
  placeholder?: string;
  currency?: string;
  decimalsLimit?: number;
  prefix?: string;
}

function CurrencyInputFieldInner<TFieldValues extends FieldValues>(
  {
    name,
    label,
    description,
    currency = 'USD',
    decimalsLimit = 2,
    prefix = '$',
    placeholder = '0.00',
    className,
    ...props
  }: CurrencyInputFieldProps<TFieldValues>,
  ref: React.Ref<HTMLInputElement>,
) {
  const {
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<TFieldValues>();
  const errorMessage = errors[name]?.message as string | undefined;

  const currentValue = watch(name) as string | undefined;

  const handleChange = (value?: string) => {
    setValue(name, (value ?? '') as any, {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  return (
    <FieldWrapper
      name={name as string}
      label={label}
      description={description}
      error={errorMessage}
    >
      <CurrencyInput
        id={name as string}
        name={name as string}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          errorMessage && 'border-destructive focus-visible:ring-destructive',
          className,
        )}
        placeholder={placeholder}
        value={currentValue ?? ''}
        decimalsLimit={decimalsLimit}
        prefix={prefix}
        onValueChange={handleChange}
        {...props}
        aria-invalid={!!errorMessage}
      />
    </FieldWrapper>
  );
}

export const CurrencyInputField = React.memo(
  React.forwardRef(CurrencyInputFieldInner as any) as unknown as <
    TFieldValues extends FieldValues = FieldValues,
  >(
    props: CurrencyInputFieldProps<TFieldValues> & {
      ref?: React.Ref<HTMLInputElement>;
    },
  ) => React.ReactElement,
);

CurrencyInputField.displayName = 'CurrencyInputField';
