export const CORE_EMAILS = [
  'team.nyghto@gmail.com',
  'salurinshan9539@gmail.com',
  'amaldas.co@gmail.com',
  'shahalmuhammed404@gmail.com'
];

export const ADMIN_EMAILS = CORE_EMAILS;

export const isCoreFounder = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return CORE_EMAILS.includes(email.toLowerCase().trim());
};

export const hasAdminAccess = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return CORE_EMAILS.includes(email.toLowerCase().trim());
};

export const isSuperAdmin = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return email.toLowerCase().trim() === 'team.nyghto@gmail.com';
};

export const getUserRole = (email: string | null | undefined, fallbackRole: string = 'Employee'): string => {
  if (!email) return fallbackRole;
  const lower = email.toLowerCase();
  if (lower === 'salurinshan9539@gmail.com') return 'CEO';
  if (lower === 'amaldas.co@gmail.com') return 'CTO';
  if (lower === 'shahalmuhammed404@gmail.com') return 'CPO';
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

