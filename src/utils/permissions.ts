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

export const getUserRole = (email: string | null | undefined, fallbackRole: string = 'Employee'): string => {
  if (!email) return fallbackRole;
  const lower = email.toLowerCase();
  if (lower === 'salurinshan9539@gmail.com') return 'CEO';
  if (lower === 'shahalmuhammed404@gmail.com') return 'CTO';
  if (lower === 'amaldas.co@gmail.com') return 'CPO';
  if (lower === 'team.nyghto@gmail.com') return 'Super Admin';
  return fallbackRole;
};

export const getUserName = (email: string | null | undefined, fallbackName: string = 'User'): string => {
  if (!email) return fallbackName;
  const lower = email.toLowerCase();
  if (lower === 'salurinshan9539@gmail.com') return 'Salih Rinshan';
  if (lower === 'shahalmuhammed404@gmail.com') return 'Shahal Muhammed';
  if (lower === 'amaldas.co@gmail.com') return 'Amal Das';
  if (lower === 'team.nyghto@gmail.com') return 'Nyghto Admin';
  return fallbackName;
};

export const getUserAvatar = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const lower = email.toLowerCase();
  if (lower === 'salurinshan9539@gmail.com') return '/rinshan.jpg';
  if (lower === 'shahalmuhammed404@gmail.com') return '/shahal.jpg';
  if (lower === 'amaldas.co@gmail.com') return '/amal.jpg';
  return null;
};

