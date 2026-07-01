export const adminHeader = {
  fr: {
    title: "ADMINISTRATION",
    restrictedAccess: (email: string) => `Accès restreint · ${email}`,
  },
  en: {
    title: "ADMINISTRATION",
    restrictedAccess: (email: string) => `Restricted access · ${email}`,
  },
};
