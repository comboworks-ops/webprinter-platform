import { createContext, useContext, useState, ReactNode } from "react";

type Language = "da" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  da: {
    // Header
    home: "Forside",
    calculator: "Prisberegner",
    contact: "Kontakt",
    about: "Om os",
    products: "Produkter",
    orderNow: "Bestil nu",
    login: "Log ind",
    logout: "Log ud",
    myProfile: "Min profil",
    adminPanel: "Admin panel",
    
    // Auth
    email: "Email",
    password: "Adgangskode",
    signIn: "Log ind",
    signUp: "Opret konto",
    dontHaveAccount: "Har du ikke en konto?",
    alreadyHaveAccount: "Har du allerede en konto?",
    createAccount: "Opret konto",
    signingIn: "Logger ind...",
    creatingAccount: "Opretter konto...",
    
    // Profile
    firstName: "Fornavn",
    lastName: "Efternavn",
    phone: "Telefon",
    company: "Virksomhed",
    saveChanges: "Gem ændringer",
    saving: "Gemmer...",
    emailCannotChange: "Email kan ikke ændres",
    enterFirstName: "Indtast dit fornavn",
    enterLastName: "Indtast dit efternavn",
    enterPhone: "Indtast dit telefonnummer",
    enterCompany: "Indtast dit firmanavn",
    personalInfo: "Administrer dine personlige oplysninger",
    
    // Admin
    adminLogin: "Administrator Login",
    accessRestricted: "Adgang kun for administratorer",
    signInAsAdmin: "Log ind som administrator",
    backToHome: "Tilbage til forsiden",
    accessDenied: "Adgang nægtet",
    noAdminPrivileges: "Du har ikke administrator rettigheder",
    
    // Common
    success: "Succes",
    error: "Fejl",
    validationError: "Valideringsfejl",
    invalidEmail: "Ugyldig email adresse",
    passwordMinLength: "Adgangskode skal være mindst 6 tegn",
    loginFailed: "Login mislykkedes",
    invalidCredentials: "Ugyldige loginoplysninger",
    loggedOut: "Logget ud",
    profileUpdated: "Profil opdateret",
    failedToLoad: "Kunne ikke indlæse",
    failedToUpdate: "Kunne ikke opdatere",
    
    // Quote Modal
    loginRequired: "Log venligst ind",
    loginRequiredDescription: "Du skal være logget ind for at anmode om et tilbud. Klik på 'Log ind' i øverste højre hjørne.",
  },
  en: {
    // Header
    home: "Home",
    calculator: "Price Calculator",
    contact: "Contact",
    about: "About Us",
    products: "Products",
    orderNow: "Order Now",
    login: "Login",
    logout: "Logout",
    myProfile: "My Profile",
    adminPanel: "Admin Panel",
    
    // Auth
    email: "Email",
    password: "Password",
    signIn: "Sign In",
    signUp: "Sign Up",
    dontHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    createAccount: "Create Account",
    signingIn: "Signing in...",
    creatingAccount: "Creating account...",
    
    // Profile
    firstName: "First Name",
    lastName: "Last Name",
    phone: "Phone",
    company: "Company",
    saveChanges: "Save Changes",
    saving: "Saving...",
    emailCannotChange: "Email cannot be changed",
    enterFirstName: "Enter your first name",
    enterLastName: "Enter your last name",
    enterPhone: "Enter your phone number",
    enterCompany: "Enter your company name",
    personalInfo: "Manage your personal information",
    
    // Admin
    adminLogin: "Administrator Login",
    accessRestricted: "Access restricted to administrators only",
    signInAsAdmin: "Sign in as Admin",
    backToHome: "Back to home",
    accessDenied: "Access Denied",
    noAdminPrivileges: "You do not have administrator privileges",
    
    // Common
    success: "Success",
    error: "Error",
    validationError: "Validation Error",
    invalidEmail: "Invalid email address",
    passwordMinLength: "Password must be at least 6 characters",
    loginFailed: "Login Failed",
    invalidCredentials: "Invalid credentials",
    loggedOut: "Logged out successfully",
    profileUpdated: "Profile updated successfully",
    failedToLoad: "Failed to load",
    failedToUpdate: "Failed to update",
    
    // Quote Modal
    loginRequired: "Please log in",
    loginRequiredDescription: "You must be logged in to request a quote. Click 'Login' in the top right corner.",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("da");

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.da] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
};
