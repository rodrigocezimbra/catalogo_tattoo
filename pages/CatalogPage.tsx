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
    selectedCategory: string;
    resetToken: number;
    onFilterChange: (filters: { searchTerm?: string; category?: string; }) => void;
}> = ({ categories, selectedCategory, resetToken, onFilterChange }) => {
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        setSearchTerm('');
    }, [resetToken]);

    useEffect(() => {
        const handler = setTimeout(() => {
            onFilterChange({ searchTerm, category: selectedCategory });
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm, selectedCategory, onFilterChange]);

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
                    value={selectedCategory}
                    onChange={(e) => onFilterChange({ searchTerm, category: e.target.value })}
                >
                    <option value="">Todas as categorias</option>
                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.nome}</option>)}
                </select>
            </div>
        </div>
    );
};

type FeaturedCollection = {
    category: Categoria;
    image: string;
    itemCount: number;
};

const PromoCarousel: React.FC<{
    collections: FeaturedCollection[];
    onSelect: (categoryId: number) => void;
}> = ({ collections, onSelect }) => {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (collections.length < 2) return;
        const interval = window.setInterval(() => {
            setActiveIndex(index => (index + 1) % collections.length);
        }, 5000);
        return () => window.clearInterval(interval);
    }, [collections.length]);

    useEffect(() => {
        setActiveIndex(index => index % Math.max(collections.length, 1));
    }, [collections.length]);

    if (collections.length === 0) return null;

    const activeCollection = collections[activeIndex];
    const changeSlide = (direction: number) => {
        setActiveIndex(index => (index + direction + collections.length) % collections.length);
    };

    return (
        <section className="mb-8" aria-label="Categorias em destaque">
            <div className="mb-3 flex items-end justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-gold-400">Categorias em destaque</p>
                    <h2 className="font-cinzel text-xl text-white">Explore nossas coleções</h2>
                </div>
                {collections.length > 1 && (
                    <div className="flex gap-2">
                        <button type="button" onClick={() => changeSlide(-1)} aria-label="Categoria anterior" className="h-9 w-9 rounded-full border border-white/20 text-white transition hover:border-brand-gold-400 hover:text-brand-gold-400">‹</button>
                        <button type="button" onClick={() => changeSlide(1)} aria-label="Próxima categoria" className="h-9 w-9 rounded-full border border-white/20 text-white transition hover:border-brand-gold-400 hover:text-brand-gold-400">›</button>
                    </div>
                )}
            </div>
            <button
                type="button"
                onClick={() => onSelect(activeCollection.category.id)}
                className="group relative block h-52 w-full overflow-hidden rounded-lg bg-gray-900 text-left sm:h-64"
                aria-label={`Ver artes da categoria ${activeCollection.category.nome}`}
            >
                <img src={activeCollection.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
                <div className="absolute inset-y-0 left-0 flex max-w-xl flex-col items-start justify-center p-6 sm:p-10">
                    <span className="mb-3 rounded-full bg-brand-gold-500 px-3 py-1 text-xs font-bold uppercase tracking-wide text-black">Coleção em destaque</span>
                    <h3 className="font-cinzel text-2xl font-bold text-white sm:text-4xl">{activeCollection.category.nome}</h3>
                    <p className="mt-2 text-sm text-gray-200">{activeCollection.itemCount} {activeCollection.itemCount === 1 ? 'arte disponível' : 'artes disponíveis'}</p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-gold-300">Ver categoria <span aria-hidden="true">→</span></span>
                </div>
                {collections.length > 1 && (
                    <div className="absolute bottom-4 right-5 flex gap-1.5" aria-hidden="true">
                        {collections.map((collection, index) => (
                            <span key={collection.category.id} className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-brand-gold-400' : 'w-1.5 bg-white/60'}`} />
                        ))}
                    </div>
                )}
            </button>
        </section>
    );
};

type ServiceOffer = {
    eyebrow: string;
    title: string;
    description: string;
    action: string;
    url: string;
    theme: string;
    icon: 'sparkles' | 'studio' | 'laser';
    reference: string;
};

const serviceOffers: ServiceOffer[] = [
    {
        eyebrow: 'Sua ideia vira desenho',
        title: 'Não encontrou a arte que procura?',
        description: 'Crie uma referência exclusiva para sua próxima tatuagem com nossa I.A.',
        action: 'Criar minha arte',
        url: 'https://artcentral.vercel.app/',
        theme: 'from-[#292824] via-[#242320] to-[#1b1b19]',
        icon: 'sparkles',
        reference: 'IDEIA  /  ARTE  /  TATTOO',
    },
    {
        eyebrow: 'Cezimbra Tattoo Studio',
        title: 'Sua próxima tattoo é em Rondonópolis',
        description: 'Atendimento presencial, personalizado e com hora marcada.',
        action: 'Conhecer o estúdio',
        url: 'https://cezimbratattoo.vercel.app/',
        theme: 'from-[#30302c] via-[#252522] to-[#1b1b19]',
        icon: 'studio',
        reference: 'RONDONÓPOLIS  /  MT',
    },
    {
        eyebrow: 'Remoção especializada',
        title: 'Uma nova chance para a sua pele',
        description: 'Conheça o serviço especializado de remoção de tatuagem a laser.',
        action: 'Conhecer remoção a laser',
        url: 'https://cezimbratattoo.vercel.app/remover_tattoo.html',
        theme: 'from-[#292a29] via-[#222322] to-[#191a19]',
        icon: 'laser',
        reference: 'TECNOLOGIA  /  CUIDADO',
    },
];

const BeforeAfterPhoto: React.FC = () => (
    <div className="before-after-photo absolute inset-0 overflow-hidden" aria-label="Comparação real antes e depois da remoção">
        <img
            src="https://cezimbratattoo.vercel.app/fotos/antes.JPG"
            alt="Antes da remoção a laser"
            className="absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
        />
        <img
            src="https://cezimbratattoo.vercel.app/fotos/depois.JPG"
            alt="Depois da remoção a laser"
            className="before-after-reveal absolute inset-0 h-full w-full object-cover object-center"
            loading="lazy"
        />
        <span className="before-after-divider absolute inset-y-0 left-0 w-0.5 bg-white shadow-[0_0_14px_rgba(255,255,255,.8)]" aria-hidden="true" />
        <span className="absolute bottom-4 left-4 rounded bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Antes</span>
        <span className="absolute bottom-4 right-4 rounded bg-black/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">Depois</span>
    </div>
);

const OfferPhotoBackground: React.FC<{ icon: ServiceOffer['icon'] }> = ({ icon }) => {
    if (icon === 'studio') {
        const tiles = [
            [1425, 2237], [1426, 2237], [1427, 2237], [1428, 2237],
            [1425, 2238], [1426, 2238], [1427, 2238], [1428, 2238],
        ];

        return (
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-2 overflow-hidden" aria-hidden="true">
                {tiles.map(([x, y]) => (
                    <img
                        key={`${x}-${y}`}
                        src={`https://tile.openstreetmap.org/12/${x}/${y}.png`}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                    />
                ))}
                <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-gray-800 shadow">Rondonópolis, MT</span>
                <span className="absolute bottom-4 right-4 rounded bg-white/85 px-2 py-1 text-[9px] text-gray-700">© OpenStreetMap contributors</span>
            </div>
        );
    }

    if (icon === 'laser') {
        return <BeforeAfterPhoto />;
    }

    return (
        <img
            src="https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=1600&q=85"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_38%]"
            loading="lazy"
        />
    );
};

const ServiceOfferCarousel: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) return;
        const interval = window.setInterval(() => {
            setActiveIndex(index => (index + 1) % serviceOffers.length);
        }, 6500);
        return () => window.clearInterval(interval);
    }, [isPaused]);

    const changeSlide = (direction: number) => {
        setActiveIndex(index => (index + direction + serviceOffers.length) % serviceOffers.length);
    };

    const offer = serviceOffers[activeIndex];

    return (
        <section
            className="mb-8"
            aria-label="Serviços do estúdio"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsPaused(false);
            }}
        >
            <div className="relative overflow-hidden rounded-xl shadow-xl">
                <a
                    key={offer.url}
                    href={offer.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`service-offer-enter group relative grid min-h-64 overflow-hidden bg-gradient-to-br ${offer.theme} text-left text-gray-100 sm:min-h-72 md:grid-cols-[1.15fr_.85fr]`}
                    aria-label={`${offer.title} ${offer.action}`}
                >
                    <span className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rotate-12 border-[28px] border-white/[0.04]" aria-hidden="true" />
                    <span className="pointer-events-none absolute -bottom-24 right-1/4 h-52 w-52 -rotate-12 border-[20px] border-white/[0.03]" aria-hidden="true" />
                    <OfferPhotoBackground icon={offer.icon} />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#1b1b19] via-[#1b1b19]/85 to-[#1b1b19]/25" aria-hidden="true" />
                    <div className="relative z-10 flex flex-col items-start justify-center p-6 sm:p-9 md:p-10">
                        <span className="mb-3 inline-flex rounded-full border border-brand-gold-700/50 bg-black/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-gold-300">{offer.eyebrow}</span>
                        <h2 className="max-w-xl text-2xl font-extrabold leading-tight sm:text-3xl">{offer.title}</h2>
                        <p className="mt-2 max-w-lg text-sm font-medium text-gray-300 sm:text-base">{offer.description}</p>
                        <span className="mt-5 inline-flex items-center gap-3 rounded-full border border-brand-gold-700/60 bg-black/30 px-5 py-3 text-sm font-bold text-brand-gold-200 transition-transform group-hover:translate-x-1">
                            {offer.action}<span aria-hidden="true">→</span>
                        </span>
                    </div>
                    <div className="relative hidden min-h-64 md:block">
                        <span className="absolute bottom-7 right-8 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-bold tracking-widest text-gray-300">{offer.reference}</span>
                    </div>
                </a>
                <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 sm:bottom-5 sm:right-6">
                    <button type="button" onClick={() => changeSlide(-1)} aria-label="Serviço anterior" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-bold text-white transition hover:border-brand-gold-500 hover:text-brand-gold-300">‹</button>
                    {serviceOffers.map((item, index) => (
                        <button
                            key={item.url}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Mostrar serviço ${index + 1}: ${item.eyebrow}`}
                            aria-current={index === activeIndex}
                            className={`h-2 rounded-full transition-all ${index === activeIndex ? 'w-6 bg-brand-gold-400' : 'w-2 bg-white/40 hover:bg-white/70'}`}
                        />
                    ))}
                    <button type="button" onClick={() => changeSlide(1)} aria-label="Próximo serviço" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/45 text-lg font-bold text-white transition hover:border-brand-gold-500 hover:text-brand-gold-300">›</button>
                </div>
            </div>
        </section>
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
    const [featuredCollections, setFeaturedCollections] = useState<FeaturedCollection[]>([]);
    const [filterResetToken, setFilterResetToken] = useState(0);
    const handleFilterChange = useCallback((nextFilters: { searchTerm?: string; category?: string }) => {
        setFilters(current => {
            const updated = { ...current, ...nextFilters };
            if ((current.searchTerm || '') === (updated.searchTerm || '') && (current.category || '') === (updated.category || '')) {
                return current;
            }
            return updated;
        });
    }, []);

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

    useEffect(() => {
        const fetchFeaturedCollections = async () => {
            const collections = await Promise.all(categories.map(async category => {
                const { data, count, error } = await supabase
                    .from('catalogo_itens')
                    .select('imagem_base64', { count: 'exact' })
                    .eq('categoria_id', category.id)
                    .limit(1);

                if (error) {
                    console.error('Error fetching featured category:', error.message);
                    return null;
                }

                const image = data?.[0]?.imagem_base64;
                return image ? { category, image, itemCount: count || 0 } : null;
            }));

            setFeaturedCollections(collections.filter((collection): collection is FeaturedCollection => collection !== null));
        };

        if (categories.length > 0) fetchFeaturedCollections();
    }, [categories]);

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
 <ServiceOfferCarousel />
            
            
            <div>
                 {categories.length > 0 && <FilterBar categories={categories} selectedCategory={filters.category || ''} resetToken={filterResetToken} onFilterChange={handleFilterChange} />}
            </div>

           <PromoCarousel
                collections={featuredCollections}
                onSelect={categoryId => {
                    handleFilterChange({ searchTerm: '', category: String(categoryId) });
                    setFilterResetToken(token => token + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
            />

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