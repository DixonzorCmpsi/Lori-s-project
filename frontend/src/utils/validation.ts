import { MAX_LENGTHS } from './constants';

export function validateEmail(email: string): string | undefined {
  if (!email) return 'Email is required';
  if (email.length > MAX_LENGTHS.email) return `Must be ${MAX_LENGTHS.email} characters or fewer`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Invalid email format';
}

export function validatePassword(password: string): string | undefined {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Must be at least 8 characters';
}

export function validateName(name: string): string | undefined {
  if (!name.trim()) return 'Name is required';
  if (name.length > MAX_LENGTHS.name) return `Must be ${MAX_LENGTHS.name} characters or fewer`;
}

export function validateDOB(dob: string): string | undefined {
  if (!dob) return 'Date of birth is required';
  const date = new Date(dob);
  if (isNaN(date.getTime())) return 'Invalid date';

  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  if (age < 13) return 'You must be at least 13 years old';
}

export function validateRequired(value: string, fieldName: string): string | undefined {
  if (!value.trim()) return `${fieldName} is required`;
}

export function validateMaxLength(value: string, max: number): string | undefined {
  if (value.length > max) return `Must be ${max} characters or fewer`;
}
