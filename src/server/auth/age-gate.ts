/**
 * Compute age from date of birth string (YYYY-MM-DD).
 * Returns null if the date is invalid.
 */
export function computeAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Derive age range from age. Raw DOB is discarded after this.
 * Returns null if under 13 (blocked by COPPA).
 */
export function deriveAgeRange(age: number): "13-17" | "18+" | null {
  if (age < 13) return null;
  if (age < 18) return "13-17";
  return "18+";
}
