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

/**
 * Validates a username
 */
export const isValidUsername = (username: string): boolean => {
  // At least 3 characters, alphanumeric and underscores only
  return username.length >= 3 && /^[a-zA-Z0-9_]+$/.test(username);
};

/**
 * Validates a file path
 */
export const isValidPath = (path: string): boolean => {
  // Accept empty paths, paths with or without leading slash, but reject paths with '..'
  if (path === '') return true;
  if (path === '/') return true;
  
  // Don't allow paths with '..' for security
  if (path.includes('..')) return false;
  
  // Additional safety checks
  // Don't allow double slashes (like '//') or backslashes
  if (path.includes('//') || path.includes('\\')) return false;
  
  return true;
};

/**
 * Validates a file name
 */
export const isValidFilename = (filename: string): boolean => {
  // File name must not contain / or \ or ..
  return !filename.includes('/') && !filename.includes('\\') && !filename.includes('..');
};

/**
 * Validates if a string is a valid UUID
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}; 