import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { CatalogoItem, Categoria } from '../types';
import { useApp } from '../context/AppContext';
import { SpinnerIcon, SearchIcon } from '../components/Icons';

// --- Page Components ---
const ItemCard: React.FC<{ item: CatalogoItem; onClick: () => void }> = ({ item, onClick }) => (
    <div
        className="group relative block w-full bg-black rounded-lg overflow-hidden cursor-pointer mb-4 break-inside-avoid shadow-lg transform transition-transform duration-300 hover:scale-105 hover:shadow-brand-gold/30"
        onClick={onClick}
    >
        <img src={item.imagem_base64} alt={item.nome} className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 p-4 text-white">
            <h3 className="font-bold text-lg">{item.nome}</h3>
            <p className="text-brand-gold-400 font-semibold">R$ {item.preco.toFixed(2)}</p>
        </div>
    </div>
);

const FilterBar: React.FC<{
    categories: Categoria[];
    onFilterChange: (filters: { searchTerm?: string; category?: string; }) => void;
}> = ({ categories, onFilterChange }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [category, setCategory] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange({ searchTerm, category });
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, category, onFilterChange]);

    return (
        <div className="bg-gray-900/50 p-4 rounded-lg mb-8 shadow-md">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                    type="text"
                    placeholder="Buscar por nome..."
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-gold-500 focus:outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <select
                    className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white focus:ring-2 focus:ring-brand-gold-500 focus:outline-none"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                >
                    <option value="">Todas as categorias</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                </select>
            </div>
        </div>
    );
};

// --- Main Catalog Page ---
const CatalogPage: React.FC = () => {
    const [items, setItems] = useState<CatalogoItem[]>([]);
    const [categories, setCategories] = useState<Categoria[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [filters, setFilters] = useState<{ searchTerm?: string; category?: string }>({});
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const navigate = useNavigate();
    const PAGE_SIZE = 20;
    const [showFilterBar, setShowFilterBar] = useState(true);
    const [shuffledIds, setShuffledIds] = useState<number[]>([]);

    const observer = useRef<IntersectionObserver>();
    const lastItemElementRef = useCallback((node: Element | null) => {
        if (loadingMore) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => prevPage + 1);
            }
        });
        if (node && observer.current) {
            observer.current.observe(node);
        }
    }, [loadingMore, hasMore]);


    // Optimized scroll listener
    useEffect(() => {
        let currentVisibility = true;
        const handleScroll = () => {
            const shouldShow = window.scrollY < 250;
            if (shouldShow !== currentVisibility) {
                currentVisibility = shouldShow;
                setShowFilterBar(shouldShow);
            }
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Fetch categories once on mount
    useEffect(() => {
        const fetchCategoriesData = async () => {
            const { data, error } = await supabase.from('catalogo_categorias').select('*');
            if (error) {
                console.error("Error fetching categories:", error.message);
            } else if (data) {
                setCategories(data);
            }
        };
        fetchCategoriesData();
    }, []);

    const shuffleArray = (array: any[]) => {
        // Fisher-Yates shuffle
        let currentIndex = array.length, randomIndex;
        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    };

    // Effect to fetch and shuffle IDs when filters change or on initial load
    useEffect(() => {
        const fetchAndShuffleIds = async () => {
            if (categories.length === 0) return;
            setLoading(true);
            
            let query = supabase.from('catalogo_itens').select('id');
            const { searchTerm, category } = filters;
            if (searchTerm) query = query.ilike('nome', `%${searchTerm}%`);
            if (category) query = query.eq('categoria_id', parseInt(category, 10));

            const { data, error } = await query;
            
            setItems([]);
            setPage(1);

            if (error) {
                console.error("Error fetching item IDs:", error);
                setShuffledIds([]);
                setHasMore(false);
            } else if (data) {
                const ids = data.map(item => item.id);
                setShuffledIds(shuffleArray(ids));
                setHasMore(ids.length > 0);
            }
            setLoading(false);
        };
        fetchAndShuffleIds();
    }, [filters, categories]);

    // Effect to fetch item data for the current page from the shuffled list
    useEffect(() => {
        if (page === 1 && loading) return; // Don't run while IDs are being fetched initially
        if (shuffledIds.length === 0 && !loading) return;

        const fetchItemsByPage = async () => {
            setLoadingMore(true);
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE;
            const idSlice = shuffledIds.slice(from, to);

            if (idSlice.length === 0) {
                setHasMore(false);
                setLoadingMore(false);
                return;
            }

            const { data, error } = await supabase.from('catalogo_itens').select('*').in('id', idSlice);

            if (error) {
                console.error("Error fetching items by ID:", error);
            } else if (data) {
                const orderedData = idSlice.map(id => data.find(item => item.id === id)).filter(Boolean) as CatalogoItem[];
                const itemsWithCategories = orderedData.map(item => {
                    const cat = categories.find(c => c.id === item.categoria_id);
                    return { ...item, catalogo_categorias: cat || { id: 0, nome: 'Sem Categoria', created_at: new Date().toISOString() } } as CatalogoItem;
                });
                setItems(prev => [...prev, ...itemsWithCategories]);
                setHasMore(to < shuffledIds.length);
            }
            setLoadingMore(false);
        };

        if (shuffledIds.length > 0) {
            fetchItemsByPage();
        }
    }, [page, shuffledIds]);

    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-5xl font-cinzel text-center text-brand-gold-500 mb-4">Catálogo de Artes</h1>
            <p className="text-center text-gray-400 mb-8 max-w-2xl mx-auto">Explore nossas artes exclusivas. Encontre a inspiração para sua próxima tatuagem.</p>
            
            <div className={`transition-all duration-300 ease-in-out ${showFilterBar ? 'opacity-100' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
                 {categories.length > 0 && <FilterBar categories={categories} onFilterChange={setFilters} />}
            </div>

            {!showFilterBar && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 bg-brand-gold-500 text-brand-dark p-4 rounded-full shadow-lg z-40 hover:bg-brand-gold-600 transition-all duration-300 transform hover:scale-110"
                    aria-label="Mostrar filtros"
                >
                    <SearchIcon className="w-6 h-6" />
                </button>
            )}
            
            {loading && (
                <div className="flex justify-center items-center h-64">
                    <SpinnerIcon className="w-16 h-16 text-brand-gold-500" />
                </div>
            )}

            {!loading && items.length === 0 && (
                <div className="text-center py-16">
                   <p className="text-gray-400 text-lg">Nenhuma arte encontrada com os filtros atuais.</p>
               </div>
            )}

            {items.length > 0 && (
                 <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4">
                    {items.map(item => (
                        <ItemCard key={item.id} item={item} onClick={() => navigate(`/produto/${item.id}`)} />
                    ))}
                </div>
            )}
            
            {loadingMore && (
                 <div className="flex justify-center items-center h-24">
                    <SpinnerIcon className="w-12 h-12 text-brand-gold-500" />
                </div>
            )}

            <div ref={lastItemElementRef} />

        </div>
    );
};

export default CatalogPage;