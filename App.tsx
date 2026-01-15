import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { CartItem, CompanySettings } from './types';
import CatalogPage from './pages/CatalogPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import { CartIcon, CloseIcon, TrashIcon } from './components/Icons';
import { AppContext, useApp } from './context/AppContext';

// --- Main App Component ---
const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const localData = localStorage.getItem('tattooCart');
            return localData ? JSON.parse(localData) : [];
        } catch (error) {
            return [];
        }
    });
    const [isCartOpen, setCartOpen] = useState(false);
    const [isInitialized, setInitialized] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            const { data: companySettings, error } = await supabase
                .from('configuracoes_empresa')
                .select('*')
                .single();
            if (companySettings) setSettings(companySettings);
            
            setInitialized(true);

            const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
                setSession(session);
            });

            return () => {
                authListener?.subscription.unsubscribe();
            };
        };
        fetchInitialData();
    }, []);
    
    useEffect(() => {
        localStorage.setItem('tattooCart', JSON.stringify(cart));
    }, [cart]);
    
    const addToCart = async (itemId: number) => {
        const { data: item } = await supabase
            .from('catalogo_itens')
            .select('*, catalogo_categorias(*)')
            .eq('id', itemId)
            .single();

        if (item) {
            setCart(prevCart => {
                const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
                if (existingItem) {
                    return prevCart.map(cartItem =>
                        cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
                    );
                }
                return [...prevCart, { ...item, quantity: 1 }];
            });
            setCartOpen(true);
        }
    };
    
    const removeFromCart = (itemId: number) => {
        setCart(cart.filter(item => item.id !== itemId));
    };
    
    const updateQuantity = (itemId: number, quantity: number) => {
        if (quantity <= 0) {
            removeFromCart(itemId);
        } else {
            setCart(cart.map(item => item.id === itemId ? { ...item, quantity } : item));
        }
    };

    const clearCart = () => setCart([]);
    
    if (!isInitialized) {
        return <div className="h-screen w-screen flex items-center justify-center bg-brand-dark text-brand-gold font-cinzel">Loading Studio...</div>
    }

    return (
        <AppContext.Provider value={{ session, settings, cart, addToCart, removeFromCart, updateQuantity, clearCart, isCartOpen, setCartOpen }}>
            <HashRouter>
                <div className="min-h-screen bg-brand-dark text-gray-100 font-roboto flex flex-col">
                    <Navbar />
                    <CartDrawer />
                    <main className="flex-grow">
                        <Routes>
                            <Route path="/" element={<CatalogPage />} />
                            <Route path="/login" element={<LoginPage />} />
                            <Route path="/admin/*" element={
                                <ProtectedRoute>
                                    <AdminPage />
                                </ProtectedRoute>
                            } />
                        </Routes>
                    </main>
                    <Footer />
                </div>
            </HashRouter>
        </AppContext.Provider>
    );
};

// --- Layout Components (defined in App.tsx to reduce file count) ---
const Navbar: React.FC = () => {
    const { settings, cart, setCartOpen, session } = useApp();
    const location = useLocation();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const isAdminRoute = location.pathname.startsWith('/admin');

    const menuItems = [
        { name: 'Conheça nosso trabalho', url: 'https://cezimbratattoo.vercel.app' },
        { name: 'Fazer orçamento de tatuagem', url: 'https://cezimbratattoo.vercel.app/fazer_tattoo.html' },
        { name: 'Guia de Cuidados', url: 'https://cezimbratattoo.vercel.app/guia-cuidados.html' },
        { name: 'Remoção a Laser', url: 'https://cezimbratattoo.vercel.app/remover_tattoo.html' },
        { name: 'Curso de tatuagem', url: 'https://cezimbratattoo.vercel.app/curso-tatuagem.html' }
    ];

    return (
        <header className="bg-black/50 backdrop-blur-lg sticky top-0 z-40 shadow-lg shadow-brand-gold/10">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    <div className="flex items-center space-x-4">
                        {/* Mobile menu button */}
                        <button 
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="md:hidden text-gray-300 hover:text-brand-gold-400 focus:outline-none"
                            aria-label="Menu"
                        >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                {isMenuOpen ? (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                ) : (
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                                )}
                            </svg>
                        </button>
                        
                        <Link to="/" className="text-2xl md:text-3xl font-bold font-cinzel text-brand-gold-500 tracking-widest transition-opacity hover:opacity-80">
                            {settings?.nome_empresa || "Cezimbra Tattoo"}
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center space-x-8">
                        <div className="relative group">
                            <button className="flex items-center space-x-1 text-gray-300 hover:text-brand-gold-400 transition-colors">
                                <span>Menu</span>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            <div className="absolute right-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-md rounded-lg shadow-xl py-2 z-50 hidden group-hover:block">
                                {menuItems.map((item, index) => (
                                    <a
                                        key={index}
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block px-4 py-2 text-sm text-gray-300 hover:bg-brand-gold-500/10 hover:text-brand-gold-400 transition-colors"
                                    >
                                        {item.name}
                                    </a>
                                ))}
                            </div>
                        </div>
                        
                        {session && isAdminRoute && <Link to="/" className="text-sm text-gray-300 hover:text-brand-gold-400 transition-colors">View Catalog</Link>}
                        {session && !isAdminRoute && <Link to="/admin" className="text-sm text-gray-300 hover:text-brand-gold-400 transition-colors">Admin Panel</Link>}
                        {!isAdminRoute && (
                            <button onClick={() => setCartOpen(true)} className="relative text-gray-200 hover:text-brand-gold-400 transition-colors">
                                <CartIcon className="w-7 h-7" />
                                {cartItemCount > 0 && (
                                    <span className="absolute -top-2 -right-2 bg-brand-gold-500 text-brand-dark text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                        {cartItemCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Mobile Menu */}
                    {isMenuOpen && (
                        <div className="absolute top-20 left-0 right-0 bg-gray-900/95 backdrop-blur-md md:hidden z-50 py-2 shadow-lg">
                            {menuItems.map((item, index) => (
                                <a
                                    key={index}
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block px-6 py-3 text-gray-300 hover:bg-brand-gold-500/10 hover:text-brand-gold-400 transition-colors border-b border-gray-800"
                                    onClick={() => setIsMenuOpen(false)}
                                >
                                    {item.name}
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const CartDrawer: React.FC = () => {
    const { settings, isCartOpen, setCartOpen, cart, removeFromCart, updateQuantity } = useApp();
    const subtotal = cart.reduce((sum, item) => sum + item.preco * item.quantity, 0);
    const whatsappText = encodeURIComponent(`Olá, gostaria de reservar os seguintes itens do carrinho: \n\n${cart.map(item => `${item.quantity}x ${item.nome} - R$${item.preco.toFixed(2)}`).join('\n')}\n\nTotal: R$${subtotal.toFixed(2)}`);
    const whatsappLink = `https://api.whatsapp.com/send?phone=${settings?.whatsapp || '5566992156546'}&text=${whatsappText}`;

    return (
        <>
            <div onClick={() => setCartOpen(false)} className={`fixed inset-0 bg-black/60 z-40 transition-opacity ${isCartOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}></div>
            <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-brand-dark shadow-2xl shadow-brand-gold/20 z-50 transform transition-transform duration-300 ease-in-out ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="flex flex-col h-full">
                    <div className="flex items-center justify-between p-6 border-b border-gray-700">
                        <h2 className="font-cinzel text-2xl text-brand-gold-500">Carrinho</h2>
                        <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                            <CloseIcon />
                        </button>
                    </div>

                    {cart.length === 0 ? (
                        <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
                            <CartIcon className="w-24 h-24 text-gray-600 mb-4" />
                            <h3 className="text-xl font-semibold text-gray-300">Seu carrinho está vazio</h3>
                            <p className="text-gray-500 mt-2">Adicione artes do catálogo para reservar.</p>
                        </div>
                    ) : (
                        <div className="flex-grow overflow-y-auto p-4">
                            {cart.map(item => (
                                <div key={item.id} className="flex items-center space-x-4 mb-4 bg-gray-900/50 p-3 rounded-lg">
                                    <img src={item.imagem_base64} alt={item.nome} className="w-20 h-20 object-cover rounded-md" />
                                    <div className="flex-grow">
                                        <h3 className="font-semibold text-white">{item.nome}</h3>
                                        <p className="text-sm text-brand-gold-400">R$ {item.preco.toFixed(2)}</p>
                                        <div className="flex items-center mt-2">
                                            <input type="number" value={item.quantity} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))} className="w-16 bg-gray-800 text-white rounded-md border border-gray-700 text-center" />
                                        </div>
                                    </div>
                                    <button onClick={() => removeFromCart(item.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {cart.length > 0 && (
                        <div className="p-6 border-t border-gray-700">
                             <div className="flex justify-between items-center mb-4 text-lg">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="font-bold text-white">R$ {subtotal.toFixed(2)}</span>
                            </div>
                            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="w-full text-center bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2">
                                <span>Finalizar no WhatsApp</span>
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

const Footer: React.FC = () => {
    const { settings } = useApp();
    return (
        <footer className="bg-black py-6 mt-12">
            <div className="container mx-auto px-4 text-center text-gray-500">
                <p>&copy; {new Date().getFullYear()} {settings?.nome_empresa || "Cezimbra Tattoo"}. Todos os direitos reservados.</p>
                {settings?.instagram && <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:text-brand-gold-400 transition-colors">Instagram</a>}
            </div>
        </footer>
    );
}

// --- Protected Route ---
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { session } = useApp();
    const navigate = useNavigate();

    useEffect(() => {
        if (!session) {
            navigate('/login');
        }
    }, [session, navigate]);

    return session ? <>{children}</> : null;
};

export default App;