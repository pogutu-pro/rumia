import * as React from 'react';
import {
  useFormContext,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

interface FieldWrapperProps {
  name: string;
  label?: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FieldWrapper({
  name,
  label,
  description,
  error,
  children,
  className,
}: FieldWrapperProps) {
  const fieldId = name;
  const errorId = error ? `${fieldId}-error` : undefined;
  const descriptionId = description ? `${fieldId}-description` : undefined;

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label
          htmlFor={fieldId}
          className="text-sm font-medium text-gray-700 flex items-center gap-1"
        >
          {label}
        </label>
      )}
      {React.cloneElement(children as React.ReactElement<any>, {
        id: fieldId,
        'aria-invalid': !!error,
        'aria-describedby': error
          ? errorId
          : description
            ? descriptionId
            : undefined,
      })}
      {!error && description && (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-red-600 flex items-center gap-1"
        >
          <AlertCircle className="h-4 w-4" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

interface InputFieldProps<TFieldValues extends FieldValues>
  extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'name' | 'id'> {
  name: FieldPath<TFieldValues>;
  label?: string;
  description?: string;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps<any>>(
  ({ name, label, description, ...props }, ref) => {
    const {
      register,
      formState: { errors },
    } = useFormContext();

    const errorMessage = (errors[name] as any)?.message as string | undefined;
    const { ref: registerRef, ...registerProps } = register(name);

    return (
      <FieldWrapper
        name={name as string}
        label={label}
        description={description}
        error={errorMessage}
      >
        <Input
          {...registerProps}
          ref={(e) => {
            registerRef(e);
            if (typeof ref === 'function') ref(e);
            else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = e;
          }}
          {...props}
          className={cn(
            'h-11 transition-colors',
            errorMessage
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-gray-300 focus:border-gray-500',
            props.className,
          )}
        />
      </FieldWrapper>
    );
  },
);

InputField.displayName = 'InputField';

interface FormFieldProps extends Omit<React.ComponentPropsWithoutRef<typeof Input>, 'error'> {
  label?: string;
  error?: string;
  description?: string;
  hint?: string;
}

const FormField = React.forwardRef<HTMLInputElement, FormFieldProps>(
  ({ label, error: errorMessage, description, hint, className, id, ...props }, ref) => {
    const fieldId = id || React.useId();
    const errorId = errorMessage ? `${fieldId}-error` : undefined;
    const fieldDescription = description || hint;
    const descriptionId = fieldDescription
      ? `${fieldId}-description`
      : undefined;

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-foreground flex items-center gap-1"
          >
            {label}
            {props.required && <span className="text-destructive">*</span>}
          </label>
        )}
        <Input
          ref={ref}
          id={fieldId}
          error={!!errorMessage}
          className={className}
          aria-invalid={!!errorMessage}
          aria-describedby={
            errorMessage ? errorId : fieldDescription ? descriptionId : undefined
          }
          {...props}
        />
        {!errorMessage && fieldDescription && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {fieldDescription}
          </p>
        )}
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            className="text-sm text-destructive flex items-center gap-1"
          >
            <AlertCircle className="h-4 w-4" aria-hidden />
            {errorMessage}
          </p>
        )}
      </div>
    );
  },
);
FormField.displayName = 'FormField';

interface PasswordFieldProps extends Omit<FormFieldProps, 'type'> {}

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      label,
      error: errorMessage,
      description,
      className,
      id,
      ...props
    },
    ref,
  ) => {
    const fieldId = id || React.useId();
    const errorId = errorMessage ? `${fieldId}-error` : undefined;
    const descriptionId = description ? `${fieldId}-description` : undefined;

    return (
      <div className="space-y-2">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-sm font-medium text-foreground flex items-center gap-1"
          >
            {label}
            {props.required && <span className="text-destructive">*</span>}
          </label>
        )}
        <Input
          ref={ref}
          id={fieldId}
          type="password"
          error={!!errorMessage}
          className={className}
          aria-invalid={!!errorMessage}
          aria-describedby={
            errorMessage ? errorId : description ? descriptionId : undefined
          }
          {...props}
        />
        {!errorMessage && description && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
        {errorMessage && (
          <p
            id={errorId}
            role="alert"
            className="text-sm text-destructive flex items-center gap-1"
          >
            <AlertCircle className="h-4 w-4" aria-hidden />
            {errorMessage}
          </p>
        )}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';

export { FieldWrapper, InputField, FormField, PasswordField };
