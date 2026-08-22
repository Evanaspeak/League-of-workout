export const adminHeader = {
  fr: {
    title: "ADMINISTRATION",
    restrictedAccess: (email: string) => `Accès restreint · ${email}`,
  },
  en: {
    title: "ADMINISTRATION",
    restrictedAccess: (email: string) => `Restricted access · ${email}`,
  },
  es: {
    title: "ADMINISTRACIÓN",
    restrictedAccess: (email: string) => `Acceso restringido · ${email}`,
  },
  de: {
    title: "VERWALTUNG",
    restrictedAccess: (email: string) => `Zugang beschränkt · ${email}`,
  },
  zh: {
    title: "管理后台",
    restrictedAccess: (email: string) => `受限访问 · ${email}`,
  },
  ja: {
    title: "管理",
    restrictedAccess: (email: string) => `アクセス制限 · ${email}`,
  },
};
