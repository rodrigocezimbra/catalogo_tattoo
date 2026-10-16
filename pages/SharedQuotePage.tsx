import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, SpinnerIcon } from '../components/Icons';

interface SharedQuote {
    name: string;
    productName: string;
    image: string;
    createdAt: string;
}

const SharedQuotePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [quote, setQuote] = useState<SharedQuote | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        setLoading(true);
        fetch(`/api/orcamentos?id=${encodeURIComponent(id || '')}`)
            .then(async (response) => {
                if (!response.ok) throw new Error('Orçamento não encontrado.');
                return response.json() as Promise<SharedQuote>;
            })
            .then((data) => {
                if (active) setQuote(data);
            })
            .catch(() => {
                if (active) setQuote(null);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [id]);

    return (
        <main className="min-h-[calc(100vh-5rem)] bg-brand-dark px-4 py-6 sm:px-6 sm:py-10">
            <div className="mx-auto max-w-4xl">
                <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-300 underline underline-offset-4 hover:text-brand-gold-400">
                    <ArrowLeftIcon className="h-4 w-4" />
                    Voltar ao catálogo
                </Link>
                {loading ? (
                    <div className="flex min-h-[55vh] items-center justify-center"><SpinnerIcon className="h-12 w-12 text-brand-gold-500" /></div>
                ) : quote ? (
                    <article className="mx-auto mt-8 max-w-2xl">
                        <p className="text-xs uppercase text-brand-gold-400">Simulação para orçamento</p>
                        <h1 className="mt-2 break-words font-cinzel text-3xl text-brand-gold-500">{quote.name}</h1>
                        <p className="mt-2 text-gray-300">{quote.productName}</p>
                        <img src={quote.image} alt={`Montagem de tatuagem de ${quote.name}`} className="mt-6 max-h-[70vh] w-full bg-black object-contain" />
                    </article>
                ) : (
                    <section className="py-20 text-center">
                        <h1 className="font-cinzel text-2xl text-brand-gold-500">Orçamento não encontrado</h1>
                        <p className="mt-2 text-sm text-gray-400">O link pode estar inválido ou indisponível.</p>
                    </section>
                )}
            </div>
        </main>
    );
};

export default SharedQuotePage;