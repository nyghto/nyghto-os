export const ADMIN_EMAILS = [
  'team.nyghto@gmail.com',
  'shahalmuhammed404@gmail.com',
  'salurinshan9539@gmail.com',
  'amaldas.co@gmail.com'
];

export const hasAdminAccess = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};

export const isSuperAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase() === 'team.nyghto@gmail.com';
};
