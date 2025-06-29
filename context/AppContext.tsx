import React, { createContext, useContext } from 'react';
import { Session } from '@supabase/supabase-js';
import { CartItem, CompanySettings, CatalogoItem } from '../types';

export interface AppContextType {
    session: Session | null;
    settings: CompanySettings | null;
    cart: CartItem[];
    addToCart: (itemId: CatalogoItem['id']) => void;
    removeFromCart: (itemId: number) => void;
    updateQuantity: (itemId: number, quantity: number) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    setCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useApp = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useApp must be used within an AppProvider');
    return context;
};
