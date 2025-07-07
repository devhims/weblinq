/**
 * Password validation utilities
 *
 * Provides comprehensive password validation including:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one special character from allowed list
 * - Real-time validation feedback
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

// Special characters allowed in passwords
export const ALLOWED_SPECIAL_CHARS = [
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '-',
  '_',
  '+',
  '=',
  '[',
  ']',
  '{',
  '}',
  '|',
  '\\',
  ':',
  ';',
  '"',
  "'",
  '<',
  '>',
  ',',
  '.',
  '?',
  '/',
  '~',
  '`',
];

/**
 * Validates password against all requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for special character
  const hasSpecialChar = ALLOWED_SPECIAL_CHARS.some((char) =>
    password.includes(char),
  );
  if (!hasSpecialChar) {
    errors.push(
      `Password must contain at least one special character (${ALLOWED_SPECIAL_CHARS.slice(0, 8).join(', ')}, etc.)`,
    );
  }

  // Calculate strength
  let strength: 'weak' | 'medium' | 'strong' = 'weak';

  if (errors.length === 0) {
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasMultipleSpecial =
      ALLOWED_SPECIAL_CHARS.filter((char) => password.includes(char)).length >
      1;
    const isLongEnough = password.length >= 12;

    const strengthScore = [
      hasLowercase,
      hasNumber,
      hasMultipleSpecial,
      isLongEnough,
    ].filter(Boolean).length;

    if (strengthScore >= 3) {
      strength = 'strong';
    } else if (strengthScore >= 1) {
      strength = 'medium';
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Get validation status for individual requirements
 */
export function getPasswordRequirements(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: ALLOWED_SPECIAL_CHARS.some((char) =>
      password.includes(char),
    ),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };
}

/**
 * Get password strength color for UI
 */
export function getPasswordStrengthColor(
  strength: 'weak' | 'medium' | 'strong',
): string {
  switch (strength) {
    case 'weak':
      return 'text-red-500';
    case 'medium':
      return 'text-yellow-500';
    case 'strong':
      return 'text-green-500';
    default:
      return 'text-gray-400';
  }
}

/**
 * Get formatted special characters list for display
 */
export function getSpecialCharsDisplay(): string {
  return ALLOWED_SPECIAL_CHARS.slice(0, 12).join(' ') + ' ...';
}
