import React, { createContext, useContext, useState, ReactNode } from "react";
import { translations, Language, TranslationDict } from "../config/i18n";

interface LanguageContextType {
    language: Language;
    t: TranslationDict;
    setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLangState] = useState<Language>(() => {
        const saved = localStorage.getItem("preferred_language");
        return (saved as Language) || "vi";
    });

    const setLanguage = (lang: Language) => {
        setLangState(lang);
        localStorage.setItem("preferred_language", lang);
    };

    const t = translations[language];

    return (
        <LanguageContext.Provider value={{ language, t, setLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
};
