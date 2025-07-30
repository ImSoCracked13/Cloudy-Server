/**
 * Validates an email address
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates a password meets minimum requirements
 */
export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, with at least one number and one letter
  return password.length >= 8 && /\d/.test(password) && /[a-zA-Z]/.test(password);
};
