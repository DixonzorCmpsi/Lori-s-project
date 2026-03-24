import { useState, useCallback } from 'react';

type Validator<T> = (values: T) => Partial<Record<keyof T, string>>;

export function useForm<T extends Record<string, unknown>>(
  initialValues: T,
  validate?: Validator<T>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback((field: keyof T, value: unknown) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldError = useCallback((field: keyof T, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const handleBlur = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (validate) {
      const errs = validate({ ...values });
      if (errs[field]) {
        setErrors(prev => ({ ...prev, [field]: errs[field] }));
      } else {
        setErrors(prev => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    }
  }, [values, validate]);

  const handleSubmit = useCallback(async (onSubmit: (values: T) => Promise<void>) => {
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Record<keyof T, boolean>
    );
    setTouched(allTouched);

    // Validate
    if (validate) {
      const errs = validate(values);
      setErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate]);

  const setFieldErrors = useCallback((fieldErrors: { field: string; message: string }[]) => {
    const errs: Partial<Record<keyof T, string>> = {};
    for (const { field, message } of fieldErrors) {
      errs[field as keyof T] = message;
    }
    setErrors(prev => ({ ...prev, ...errs }));
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values, errors, touched, isSubmitting,
    setValue, setFieldError, setFieldErrors,
    handleBlur, handleSubmit, reset,
  };
}
