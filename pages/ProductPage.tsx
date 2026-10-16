import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useApp } from '../context/AppContext';
import { CatalogoItem } from '../types';
import { ArrowLeftIcon, SpinnerIcon, WhatsAppIcon } from '../components/Icons';

interface SimilarGroup {
    title: string;
    items: CatalogoItem[];
}

const SimilarCarousel: React.FC<{ group: SimilarGroup }> = ({ group }) => {
    const carouselRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: number) => {
        carouselRef.current?.scrollBy({ left: direction * 320, behavior: 'smooth' });
    };

    return (
        <section className="mt-12 border-t border-white/10 pt-8">
            <div className="flex items-center justify-between gap-4">
                <h2 className="font-cinzel text-xl text-brand-gold-400 sm:text-2xl">{group.title}</h2>
                <div className="flex shrink-0 gap-2">
                    <button
                        type="button"
                        onClick={() => scroll(-1)}
                        aria-label={`Rolar ${group.title} para a esquerda`}
                        className="flex h-9 w-9 items-center justify-center border border-white/20 text-gray-200 transition-colors hover:border-brand-gold-500 hover:text-brand-gold-400"
                    >
                        <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => scroll(1)}
                        aria-label={`Rolar ${group.title} para a direita`}
                        className="flex h-9 w-9 items-center justify-center border border-white/20 text-gray-200 transition-colors hover:border-brand-gold-500 hover:text-brand-gold-400"
                    >
                        <ArrowLeftIcon className="h-4 w-4 rotate-180" />
                    </button>
                </div>
            </div>
            <div ref={carouselRef} className="custom-scrollbar mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4">
                {group.items.map((similarItem) => (
                    <Link
                        key={similarItem.id}
                        to={`/produto/${similarItem.id}`}
                        className="group w-40 shrink-0 snap-start sm:w-48"
                    >
                        <div className="aspect-[4/5] overflow-hidden bg-black">
                            <img
                                src={similarItem.imagem_base64}
                                alt={similarItem.nome}
                                loading="lazy"
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                        </div>
                        <h3 className="mt-3 truncate text-sm font-medium text-gray-100 group-hover:text-brand-gold-400">{similarItem.nome}</h3>
                        <p className="mt-1 text-sm text-gray-400">R$ {similarItem.preco.toFixed(2)}</p>
                    </Link>
                ))}
            </div>
        </section>
    );
};

const ProductPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [item, setItem] = useState<CatalogoItem | null>(null);
    const [similarGroups, setSimilarGroups] = useState<SimilarGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const { addToCart, settings } = useApp();

    useEffect(() => {
        let isActive = true;
        const productId = Number(id);

        const fetchItem = async () => {
            setItem(null);
            setSimilarGroups([]);
            if (!Number.isInteger(productId) || productId < 1) {
                setLoading(false);
                return;
            }

            setLoading(true);
            const { data, error } = await supabase
                .from('catalogo_itens')
                .select('*, catalogo_categorias(*)')
                .eq('id', productId)
                .single();

            if (!isActive) return;
            if (error || !data) {
                if (error) console.error('Error fetching product:', error.message);
                setItem(null);
                setLoading(false);
                return;
            }

            const product = data as CatalogoItem;
            setItem(product);
            setLoading(false);

            const minPrice = product.preco * 0.75;
            const maxPrice = product.preco * 1.25;
            const [categoryResponse, priceResponse] = await Promise.all([
                supabase
                    .from('catalogo_itens')
                    .select('*, catalogo_categorias(*)')
                    .eq('categoria_id', product.categoria_id)
                    .neq('id', product.id)
                    .limit(12),
                supabase
                    .from('catalogo_itens')
                    .select('*, catalogo_categorias(*)')
                    .gte('preco', minPrice)
                    .lte('preco', maxPrice)
                    .neq('id', product.id)
                    .order('preco', { ascending: true })
                    .limit(12),
            ]);

            if (!isActive) return;
            if (categoryResponse.error) console.error('Error fetching category recommendations:', categoryResponse.error.message);
            if (priceResponse.error) console.error('Error fetching price recommendations:', priceResponse.error.message);

            const categoryItems = (categoryResponse.data || []) as CatalogoItem[];
            const priceItems = (priceResponse.data || []) as CatalogoItem[];
            const candidates = [...new Map([...categoryItems, ...priceItems].map((candidate) => [candidate.id, candidate])).values()];
            const groups: SimilarGroup[] = [];

            if (categoryItems.length > 0) groups.push({ title: 'Da mesma categoria', items: categoryItems });
            if (product.detalhes?.local) {
                const sameLocation = candidates.filter((candidate) => candidate.detalhes?.local === product.detalhes?.local);
                if (sameLocation.length > 0) groups.push({ title: 'Com local sugerido parecido', items: sameLocation });
            }
            if (product.detalhes?.tamanho) {
                const sameSize = candidates.filter((candidate) => candidate.detalhes?.tamanho === product.detalhes?.tamanho);
                if (sameSize.length > 0) groups.push({ title: 'Tamanho semelhante', items: sameSize });
            }
            if (priceItems.length > 0) groups.push({ title: 'Na mesma faixa de preço', items: priceItems });
            setSimilarGroups(groups);
        };

        void fetchItem();
        return () => {
            isActive = false;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <SpinnerIcon className="h-12 w-12 text-brand-gold-500" />
            </div>
        );
    }

    if (!item) {
        return (
            <section className="container mx-auto px-4 py-16 text-center">
                <h1 className="font-cinzel text-3xl text-brand-gold-500">Produto não encontrado</h1>
                <Link to="/" className="mt-6 inline-flex items-center gap-2 text-gray-300 underline underline-offset-4 hover:text-brand-gold-400">
                    <ArrowLeftIcon className="h-4 w-4" />
                    Voltar ao catálogo
                </Link>
            </section>
        );
    }

    const whatsappText = encodeURIComponent(`Olá! Tenho interesse na tatuagem "${item.nome}" e gostaria de saber mais.`);
    const whatsappLink = `https://api.whatsapp.com/send?phone=${settings?.whatsapp || '5566992156546'}&text=${whatsappText}`;

    return (
        <>
        <section className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
            <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm text-gray-300 underline underline-offset-4 transition-colors hover:text-brand-gold-400">
                <ArrowLeftIcon className="h-4 w-4" />
                Voltar ao catálogo
            </Link>
            <div className="grid gap-8 md:grid-cols-2 md:gap-12">
                <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-black">
                    <img src={item.imagem_base64} alt={item.nome} className="h-full w-full object-contain" />
                </div>
                <div className="flex flex-col py-2 md:py-8">
                    <p className="mb-3 text-sm uppercase text-brand-gold-400">{item.catalogo_categorias?.nome || 'Sem categoria'}</p>
                    <h1 className="font-cinzel text-3xl text-brand-gold-500 sm:text-4xl">{item.nome}</h1>
                    <p className="mt-4 text-2xl font-semibold text-white">R$ {item.preco.toFixed(2)}</p>
                    <div className="my-6 h-px bg-brand-gold-500/30" />
                    <h2 className="mb-2 text-sm font-semibold uppercase text-gray-300">Sobre esta arte</h2>
                    <p className="leading-relaxed text-gray-400">{item.descricao || 'Entre em contato para saber mais sobre esta arte.'}</p>
                    {(item.detalhes?.local || item.detalhes?.tamanho) && (
                        <dl className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
                            {item.detalhes.local && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500">Local sugerido</dt>
                                    <dd className="text-right text-gray-200">{item.detalhes.local}</dd>
                                </div>
                            )}
                            {item.detalhes.tamanho && (
                                <div className="flex justify-between gap-4">
                                    <dt className="text-gray-500">Tamanho</dt>
                                    <dd className="text-right text-gray-200">{item.detalhes.tamanho}</dd>
                                </div>
                            )}
                        </dl>
                    )}
                    <div className="mt-8 space-y-3">
                        <button
                            onClick={() => addToCart(item.id)}
                            className="min-h-12 w-full bg-brand-gold-500 px-5 py-3 font-semibold text-brand-dark transition-colors hover:bg-brand-gold-400"
                        >
                            Adicionar ao carrinho
                        </button>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <a
                                href={whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex min-h-12 items-center justify-center gap-2 border border-green-500 px-5 py-3 font-semibold text-green-400 transition-colors hover:bg-green-600 hover:text-white"
                            >
                                <WhatsAppIcon className="h-5 w-5" />
                                Reservar pelo WhatsApp
                            </a>
                            <button
                                type="button"
                                onClick={() => navigate(`/simular-tatuagem/${item.id}`)}
                                className="min-h-12 border border-brand-gold-500 px-5 py-3 font-semibold text-brand-gold-400 transition-colors hover:bg-brand-gold-500 hover:text-brand-dark"
                            >
                                Simular tatuagem
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            {similarGroups.map((group) => <SimilarCarousel key={group.title} group={group} />)}
        </section>
        </>
    );
};

export default ProductPage;