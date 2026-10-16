import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { CatalogoItem } from '../types';
import { ArrowLeftIcon, SpinnerIcon } from '../components/Icons';
import { useApp } from '../context/AppContext';

type Tool = 'move' | 'erase' | 'blend';
type BlendMode = 'multiply' | 'normal' | 'overlay' | 'soft-light';
type EraserTip = 'hard' | 'soft';

interface EraserPath {
    points: Array<{ x: number; y: number }>;
    width: number;
    tip: EraserTip;
}

interface GesturePoint {
    x: number;
    y: number;
}

interface MoveGesture {
    pointerIds: number[];
    center: GesturePoint;
    distance: number;
    angle: number;
    position: { x: number; y: number };
    size: number;
    rotation: number;
}

const toolNames: Record<Tool, string> = {
    move: 'Tamanho e posição',
    erase: 'Borracha',
    blend: 'Opacidade e mescla',
};

const loadImage = (source: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
});

const ToolIcon: React.FC<{ name: Tool | 'magic' }> = ({ name }) => {
    const paths: Record<Tool | 'magic', string> = {
        move: 'M12 3v18m-9-9h18m-4-7 4 7-4 7M5 5l14 14',
        erase: 'M3 15.5 14.5 4l5.5 5.5L8.5 21H3v-5.5ZM12 21h9',
        blend: 'M12 3a9 9 0 1 0 0 18V3Zm0 0a9 9 0 0 1 0 18',
        magic: 'm15 4 1.5 4.5L21 10l-4.5 1.5L15 16l-1.5-4.5L9 10l4.5-1.5L15 4ZM5 3l.8 2.2L8 6l-2.2.8L5 9l-.8-2.2L2 6l2.2-.8L5 3Zm1 12 .9 2.1L9 18l-2.1.9L6 21l-.9-2.1L3 18l2.1-.9L6 15Z',
    };
    return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
};

const TattooSimulatorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [item, setItem] = useState<CatalogoItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [photo, setPhoto] = useState<string | null>(null);
    const [photoDimensions, setPhotoDimensions] = useState({ width: 0, height: 0 });
    const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
    const [photoError, setPhotoError] = useState('');
    const [activeTool, setActiveTool] = useState<Tool | null>(null);
    const [position, setPosition] = useState({ x: 50, y: 50 });
    const [size, setSize] = useState(30);
    const [rotation, setRotation] = useState(0);
    const [opacity, setOpacity] = useState(78);
    const [blendMode, setBlendMode] = useState<BlendMode>('multiply');
    const [eraserSize, setEraserSize] = useState(22);
    const [eraserTip, setEraserTip] = useState<EraserTip>('hard');
    const [eraserPaths, setEraserPaths] = useState<EraserPath[]>([]);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [showGenerated, setShowGenerated] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState('');
    const [artReady, setArtReady] = useState(false);
    const [showQuoteDialog, setShowQuoteDialog] = useState(false);
    const [clientName, setClientName] = useState('');
    const [isSavingQuote, setIsSavingQuote] = useState(false);
    const [quoteError, setQuoteError] = useState('');
    const [savedQuote, setSavedQuote] = useState<{ url: string; whatsappUrl: string } | null>(null);
    const { settings } = useApp();
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const tattooImageRef = useRef<HTMLImageElement | null>(null);
    const pointerPositionsRef = useRef(new Map<number, GesturePoint>());
    const moveGestureRef = useRef<MoveGesture | null>(null);
    const eraserPointerRef = useRef<number | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setItem(null);
        const productId = Number(id);
        if (!Number.isInteger(productId) || productId < 1) {
            setLoading(false);
            return () => { active = false; };
        }
        void supabase.from('catalogo_itens').select('*, catalogo_categorias(*)').eq('id', productId).single()
            .then(({ data }) => {
                if (!active) return;
                setItem(data as CatalogoItem | null);
                setLoading(false);
            });
        return () => { active = false; };
    }, [id]);

    useEffect(() => {
        if (!item) return;
        const artwork = new Image();
        artwork.onload = () => {
            tattooImageRef.current = artwork;
            setArtReady(true);
        };
        artwork.onerror = () => setArtReady(false);
        artwork.src = item.imagem_base64;
        return () => {
            artwork.onload = null;
            artwork.onerror = null;
            tattooImageRef.current = null;
            setArtReady(false);
        };
    }, [item]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || !photoDimensions.width || !photoDimensions.height) return;
        const measure = () => {
            const bounds = stage.getBoundingClientRect();
            const fit = Math.min(bounds.width / photoDimensions.width, bounds.height / photoDimensions.height);
            setFrameSize({ width: photoDimensions.width * fit, height: photoDimensions.height * fit });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(stage);
        return () => observer.disconnect();
    }, [photoDimensions]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const artwork = tattooImageRef.current;
        if (!canvas || !artwork || !photo || !artReady || showGenerated || !frameSize.width) return;
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.round(frameSize.width * pixelRatio);
        canvas.height = Math.round(frameSize.height * pixelRatio);
        const context = canvas.getContext('2d');
        if (!context) return;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, frameSize.width, frameSize.height);
        const scale = frameSize.width * size / 100 / artwork.naturalWidth;
        context.save();
        context.globalAlpha = opacity / 100;
        context.translate(position.x / 100 * frameSize.width, position.y / 100 * frameSize.height);
        context.rotate(rotation * Math.PI / 180);
        context.scale(scale, scale);
        context.drawImage(artwork, -artwork.naturalWidth / 2, -artwork.naturalHeight / 2);
        context.globalAlpha = 1;
        context.globalCompositeOperation = 'destination-out';
        eraserPaths.forEach((path) => {
            context.save();
            context.filter = path.tip === 'soft' ? 'blur(5px)' : 'none';
            context.lineCap = path.tip === 'soft' ? 'round' : 'square';
            context.lineJoin = path.tip === 'soft' ? 'round' : 'bevel';
            context.lineWidth = path.width;
            context.beginPath();
            if (path.points.length === 1) {
                context.arc(path.points[0].x, path.points[0].y, path.width / 2, 0, Math.PI * 2);
                context.fill();
            } else {
                context.moveTo(path.points[0].x, path.points[0].y);
                path.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
                context.stroke();
            }
            context.restore();
        });
        context.restore();
    }, [artReady, eraserPaths, frameSize, opacity, photo, position, rotation, showGenerated, size]);

    const loadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setPhotoError('Escolha um arquivo de imagem.');
            return;
        }
        try {
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
            const resized = document.createElement('canvas');
            resized.width = Math.round(bitmap.width * scale);
            resized.height = Math.round(bitmap.height * scale);
            resized.getContext('2d')?.drawImage(bitmap, 0, 0, resized.width, resized.height);
            bitmap.close();
            setPhoto(resized.toDataURL('image/jpeg', 0.88));
            setPhotoDimensions({ width: resized.width, height: resized.height });
            setPhotoError('');
            setPosition({ x: 50, y: 50 });
            setSize(30);
            setEraserPaths([]);
            setGeneratedImage(null);
            setShowGenerated(false);
        } catch {
            setPhotoError('Não foi possível abrir esta imagem.');
        }
    };

    const clearGenerated = () => {
        setGeneratedImage(null);
        setShowGenerated(false);
        setAiError('');
    };

    const getTattooPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const artwork = tattooImageRef.current;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (!artwork || !bounds.width) return null;
        const scale = bounds.width * size / 100 / artwork.naturalWidth;
        const deltaX = event.clientX - bounds.left - position.x / 100 * bounds.width;
        const deltaY = event.clientY - bounds.top - position.y / 100 * bounds.height;
        const angle = rotation * Math.PI / 180;
        const rotatedX = deltaX * Math.cos(angle) + deltaY * Math.sin(angle);
        const rotatedY = -deltaX * Math.sin(angle) + deltaY * Math.cos(angle);
        const x = rotatedX / scale + artwork.naturalWidth / 2;
        const y = rotatedY / scale + artwork.naturalHeight / 2;
        if (x < 0 || y < 0 || x > artwork.naturalWidth || y > artwork.naturalHeight) return null;
        return { x, y, width: eraserSize / scale };
    };

    const beginMoveGesture = () => {
        const canvas = canvasRef.current;
        const points = [...pointerPositionsRef.current.entries()].slice(0, 2);
        if (!canvas || points.length === 0) return;
        const [first] = points;
        const [second] = points[1] || [];
        const center = second
            ? { x: (first[1].x + second[1].x) / 2, y: (first[1].y + second[1].y) / 2 }
            : first[1];
        const deltaX = second ? second[1].x - first[1].x : 0;
        const deltaY = second ? second[1].y - first[1].y : 0;
        moveGestureRef.current = {
            pointerIds: points.map(([pointerId]) => pointerId),
            center,
            distance: Math.hypot(deltaX, deltaY),
            angle: Math.atan2(deltaY, deltaX),
            position: { ...position },
            size,
            rotation,
        };
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!activeTool || !photo || !artReady) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        clearGenerated();

        if (activeTool === 'move') {
            beginMoveGesture();
            return;
        }

        if (activeTool === 'erase' && eraserPointerRef.current === null) {
            eraserPointerRef.current = event.pointerId;
            const point = getTattooPoint(event);
            if (point) setEraserPaths((paths) => [...paths, { points: [{ x: point.x, y: point.y }], width: point.width, tip: eraserTip }]);
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!pointerPositionsRef.current.has(event.pointerId)) return;
        pointerPositionsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (activeTool === 'move') {
            const gesture = moveGestureRef.current;
            const canvas = canvasRef.current;
            if (!gesture || !canvas) return;
            const first = pointerPositionsRef.current.get(gesture.pointerIds[0]);
            const second = gesture.pointerIds.length > 1 ? pointerPositionsRef.current.get(gesture.pointerIds[1]) : undefined;
            if (!first) return;
            const center = second ? { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 } : first;
            const bounds = canvas.getBoundingClientRect();
            setPosition({
                x: Math.max(0, Math.min(100, gesture.position.x + (center.x - gesture.center.x) / bounds.width * 100)),
                y: Math.max(0, Math.min(100, gesture.position.y + (center.y - gesture.center.y) / bounds.height * 100)),
            });
            if (second && gesture.distance > 0) {
                const deltaX = second.x - first.x;
                const deltaY = second.y - first.y;
                setSize(Math.max(8, Math.min(85, gesture.size * Math.hypot(deltaX, deltaY) / gesture.distance)));
                setRotation(gesture.rotation + (Math.atan2(deltaY, deltaX) - gesture.angle) * 180 / Math.PI);
            }
            return;
        }

        if (activeTool !== 'erase' || eraserPointerRef.current !== event.pointerId) return;
        const point = getTattooPoint(event);
        if (!point) return;
        setEraserPaths((paths) => {
            const last = paths[paths.length - 1];
            return last ? [...paths.slice(0, -1), { ...last, points: [...last.points, { x: point.x, y: point.y }] }] : paths;
        });
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        pointerPositionsRef.current.delete(event.pointerId);
        if (activeTool === 'move') beginMoveGesture();
        if (eraserPointerRef.current === event.pointerId) eraserPointerRef.current = null;
    };

    const generateWithAI = async () => {
        if (!photo || !item || isGenerating) return;
        setIsGenerating(true);
        setAiError('');
        setGeneratedImage(null);
        try {
            const response = await fetch('/api/simular-tatuagem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo, tattoo: item.imagem_base64, placement: { ...position, widthPercent: size, rotationDeg: rotation } }),
            });
            const result = await response.json() as { image?: string; error?: string };
            if (!response.ok || !result.image) throw new Error(result.error || 'Não foi possível gerar a prévia.');
            setGeneratedImage(result.image);
            setShowGenerated(true);
        } catch (error) {
            setAiError(error instanceof Error ? error.message : 'Falha ao gerar a prévia com IA.');
        } finally {
            setIsGenerating(false);
        }
    };

    const createMontage = async () => {
        if (!photo || !photoDimensions.width || !photoDimensions.height) throw new Error('Envie uma foto antes de criar o orçamento.');
        const output = document.createElement('canvas');
        output.width = photoDimensions.width;
        output.height = photoDimensions.height;
        const context = output.getContext('2d');
        if (!context) throw new Error('Não foi possível preparar a montagem.');

        if (showGenerated && generatedImage) {
            const image = await loadImage(generatedImage);
            context.drawImage(image, 0, 0, output.width, output.height);
        } else {
            const baseImage = await loadImage(photo);
            context.drawImage(baseImage, 0, 0, output.width, output.height);
            const artwork = tattooImageRef.current;
            if (!artwork) throw new Error('A arte da tatuagem ainda não está pronta.');

            const tattooLayer = document.createElement('canvas');
            tattooLayer.width = output.width;
            tattooLayer.height = output.height;
            const tattooContext = tattooLayer.getContext('2d');
            if (!tattooContext) throw new Error('Não foi possível compor a tatuagem.');
            const scale = output.width * size / 100 / artwork.naturalWidth;
            tattooContext.globalAlpha = opacity / 100;
            tattooContext.translate(position.x / 100 * output.width, position.y / 100 * output.height);
            tattooContext.rotate(rotation * Math.PI / 180);
            tattooContext.scale(scale, scale);
            tattooContext.drawImage(artwork, -artwork.naturalWidth / 2, -artwork.naturalHeight / 2);
            tattooContext.globalAlpha = 1;
            tattooContext.globalCompositeOperation = 'destination-out';
            eraserPaths.forEach((path) => {
                tattooContext.save();
                tattooContext.filter = path.tip === 'soft' ? 'blur(5px)' : 'none';
                tattooContext.lineCap = path.tip === 'soft' ? 'round' : 'square';
                tattooContext.lineJoin = path.tip === 'soft' ? 'round' : 'bevel';
                tattooContext.lineWidth = path.width;
                tattooContext.beginPath();
                if (path.points.length === 1) {
                    tattooContext.arc(path.points[0].x, path.points[0].y, path.width / 2, 0, Math.PI * 2);
                    tattooContext.fill();
                } else {
                    tattooContext.moveTo(path.points[0].x, path.points[0].y);
                    path.points.slice(1).forEach((point) => tattooContext.lineTo(point.x, point.y));
                    tattooContext.stroke();
                }
                tattooContext.restore();
            });

            const operation: GlobalCompositeOperation = blendMode === 'soft-light' ? 'soft-light' : blendMode;
            context.globalCompositeOperation = operation;
            context.drawImage(tattooLayer, 0, 0);
            context.globalCompositeOperation = 'source-over';
        }

        return output.toDataURL('image/jpeg', 0.9);
    };

    const submitQuote = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!item || !clientName.trim() || isSavingQuote) return;
        setIsSavingQuote(true);
        setQuoteError('');
        setSavedQuote(null);
        const whatsappTab = window.open('about:blank', '_blank');

        try {
            const image = await createMontage();
            const response = await fetch('/api/orcamentos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: clientName.trim(), image, productId: item.id, productName: item.nome }),
            });
            const result = await response.json() as { id?: string; error?: string };
            if (!response.ok || !result.id) throw new Error(result.error || 'Não foi possível salvar o orçamento.');

            const shareUrl = `${window.location.origin}${window.location.pathname}#/orcamento/${result.id}`;
            const message = `Olá! Gostaria de fazer um orçamento para ${item.nome}. Cliente: ${clientName.trim()}. Veja a montagem: ${shareUrl}`;
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${encodeURIComponent(settings?.whatsapp || '5566992156546')}&text=${encodeURIComponent(message)}`;
            setSavedQuote({ url: shareUrl, whatsappUrl });
            if (whatsappTab) {
                whatsappTab.location.href = whatsappUrl;
                setShowQuoteDialog(false);
            }
        } catch (error) {
            whatsappTab?.close();
            setQuoteError(error instanceof Error ? error.message : 'Não foi possível salvar o orçamento.');
        } finally {
            setIsSavingQuote(false);
        }
    };

    const resetEditor = () => {
        setPosition({ x: 50, y: 50 });
        setSize(30);
        setRotation(0);
        setOpacity(78);
        setBlendMode('multiply');
        setEraserSize(22);
        setEraserTip('hard');
        setEraserPaths([]);
        setActiveTool(null);
        clearGenerated();
    };

    if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><SpinnerIcon className="h-12 w-12 text-brand-gold-500" /></div>;
    if (!item) return <main className="px-4 py-16 text-center"><h1 className="font-cinzel text-3xl text-brand-gold-500">Produto não encontrado</h1><Link to="/" className="mt-5 inline-block text-gray-300 underline">Voltar ao catálogo</Link></main>;

    return (
        <main className={photo ? 'flex h-[calc(100dvh-5rem)] min-h-[420px] flex-col overflow-hidden bg-[#111]' : 'flex min-h-[calc(100dvh-5rem)] flex-col bg-[#111]'}>
            {!photo ? (
                <section className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center">
                    <p className="text-xs uppercase text-brand-gold-400">{item.nome}</p>
                    <div className="flex h-[min(54vh,28rem)] w-[min(76vw,24rem)] items-center justify-center bg-black/30 p-5">
                        <img src={item.imagem_base64} alt={`Arte ${item.nome}`} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="flex w-full max-w-sm flex-col gap-3 sm:flex-row">
                        <button onClick={() => cameraInputRef.current?.click()} className="min-h-12 flex-1 bg-brand-gold-500 px-5 py-3 text-sm font-semibold text-brand-dark hover:bg-brand-gold-400">Tirar foto</button>
                        <button onClick={() => galleryInputRef.current?.click()} className="min-h-12 flex-1 border border-brand-gold-500 px-5 py-3 text-sm font-semibold text-brand-gold-400 hover:bg-brand-gold-500 hover:text-brand-dark">Escolher foto</button>
                    </div>
                    <p className="text-xs text-gray-500">A foto fica no seu dispositivo até você pedir uma simulação com IA.</p>
                    {photoError && <p role="alert" className="text-sm text-red-400">{photoError}</p>}
                </section>
            ) : (
                <>
                    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-3 sm:px-5">
                        <Link to={`/produto/${id}`} aria-label="Voltar ao produto" className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"><ArrowLeftIcon className="h-4 w-4" /><span className="hidden sm:inline">{item.nome}</span><span className="sm:hidden">Voltar</span></Link>
                        <div className="flex items-center gap-2">
                            {generatedImage && <button onClick={() => setShowGenerated((value) => !value)} className="px-2 py-1 text-xs text-brand-gold-400">{showGenerated ? 'Ver edição' : 'Ver IA'}</button>}
                            <button onClick={resetEditor} aria-label="Redefinir edição" title="Redefinir edição" className="px-2 py-1 text-xs text-gray-400 hover:text-white">Redefinir</button>
                            <button onClick={() => { setPhoto(null); setGeneratedImage(null); setShowGenerated(false); }} className="border border-white/20 px-3 py-1.5 text-xs text-gray-300 hover:border-brand-gold-500">Trocar foto</button>
                        </div>
                    </header>

                    <div className="relative flex min-h-0 flex-1">
                        <nav aria-label="Ferramentas de simulação" className="z-20 flex w-12 shrink-0 flex-col items-center gap-2 border-r border-white/10 bg-[#171717] py-3 sm:w-14 sm:gap-3 sm:py-4">
                            {(['move', 'erase', 'blend'] as const).map((tool) => (
                                <button key={tool} onClick={() => { setActiveTool((current) => current === tool ? null : tool); clearGenerated(); }} aria-label={toolNames[tool]} aria-pressed={activeTool === tool} title={toolNames[tool]} className={`flex h-10 w-10 items-center justify-center border transition-colors sm:h-11 sm:w-11 ${activeTool === tool ? 'border-brand-gold-500 bg-brand-gold-500/15 text-brand-gold-400' : 'border-transparent text-gray-400 hover:border-white/20 hover:text-white'}`}>
                                    <ToolIcon name={tool} />
                                </button>
                            ))}
                            <div className="my-1 h-px w-7 bg-white/10" />
                            <button onClick={generateWithAI} disabled={isGenerating} aria-label="Gerar simulação com inteligência artificial" title="Simular com IA" className="flex h-10 w-10 items-center justify-center border border-brand-gold-500/50 text-brand-gold-400 transition-colors hover:bg-brand-gold-500 hover:text-brand-dark disabled:animate-pulse disabled:opacity-60 sm:h-11 sm:w-11">
                                {isGenerating ? <SpinnerIcon className="h-5 w-5" /> : <ToolIcon name="magic" />}
                            </button>
                        </nav>

                        <section ref={stageRef} aria-label="Prancheta" className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#202020] p-2 sm:p-4">
                            <div className="relative shrink-0 overflow-hidden bg-black shadow-2xl" style={{ width: frameSize.width || '100%', height: frameSize.height || '100%', maxWidth: '100%', maxHeight: '100%' }}>
                                {showGenerated && generatedImage ? (
                                    <img src={generatedImage} alt="Simulação da tatuagem gerada por IA" className="absolute inset-0 h-full w-full object-contain" />
                                ) : (
                                    <>
                                        <img src={photo} alt="Foto do local escolhido" className="absolute inset-0 h-full w-full select-none object-fill" draggable={false} />
                                        <canvas ref={canvasRef} aria-label={activeTool === 'erase' ? 'Arraste sobre a tatuagem para apagar' : 'Arraste a tatuagem para posicioná-la'} className="absolute inset-0 h-full w-full touch-none" style={{ mixBlendMode: blendMode, cursor: activeTool === 'erase' ? 'crosshair' : activeTool === 'move' ? 'move' : 'default' }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => { activePointerRef.current = null; }} onPointerCancel={() => { activePointerRef.current = null; }} />
                                    </>
                                )}
                            </div>
                            {isGenerating && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-center"><SpinnerIcon className="h-9 w-9 text-brand-gold-400" /><p className="text-sm text-white">Criando uma prévia realista...</p><p className="text-xs text-gray-400">A foto está sendo enviada para a IA.</p></div>}
                            {aiError && <div role="alert" className="absolute bottom-3 left-3 right-3 z-10 border border-red-400/40 bg-black/90 p-3 text-sm text-red-300 sm:left-1/2 sm:right-auto sm:w-96 sm:-translate-x-1/2">{aiError}</div>}

                            {activeTool && <section aria-label={`Controles: ${toolNames[activeTool]}`} className="absolute bottom-3 left-2 right-2 z-10 max-h-[42%] overflow-y-auto border border-white/10 bg-[#151515]/95 p-3 shadow-2xl backdrop-blur sm:bottom-5 sm:left-1/2 sm:right-auto sm:w-[min(25rem,calc(100%-5rem))] sm:-translate-x-1/2 sm:p-4">
                                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-medium text-white">{toolNames[activeTool]}</h2><button onClick={() => setActiveTool(null)} aria-label="Fechar controles" className="px-2 text-lg leading-none text-gray-400 hover:text-white">×</button></div>
                                {activeTool === 'move' && <div className="space-y-3"><label className="block text-xs text-gray-300"><span className="mb-1 flex justify-between"><span>Tamanho</span><output>{size}%</output></span><input type="range" min="8" max="85" value={size} onChange={(event) => { setSize(Number(event.currentTarget.value)); clearGenerated(); }} className="w-full accent-brand-gold-500" /></label><p className="text-[11px] text-gray-500">Arraste a arte na foto para ajustar a posição.</p></div>}
                                {activeTool === 'erase' && <div className="space-y-3"><label className="block text-xs text-gray-300"><span className="mb-1 flex justify-between"><span>Tamanho</span><output>{eraserSize}px</output></span><input type="range" min="5" max="70" value={eraserSize} onChange={(event) => setEraserSize(Number(event.currentTarget.value))} className="w-full accent-brand-gold-500" /></label><div className="grid grid-cols-2 gap-2"><button onClick={() => setEraserTip('hard')} aria-pressed={eraserTip === 'hard'} className={`min-h-9 border text-xs ${eraserTip === 'hard' ? 'border-brand-gold-500 text-brand-gold-400' : 'border-white/15 text-gray-400'}`}>Ponta dura</button><button onClick={() => setEraserTip('soft')} aria-pressed={eraserTip === 'soft'} className={`min-h-9 border text-xs ${eraserTip === 'soft' ? 'border-brand-gold-500 text-brand-gold-400' : 'border-white/15 text-gray-400'}`}>Ponta suave</button></div><button onClick={() => { setEraserPaths((paths) => paths.slice(0, -1)); clearGenerated(); }} disabled={!eraserPaths.length} className="text-xs text-gray-400 underline disabled:opacity-40">Desfazer último traço</button></div>}
                                {activeTool === 'blend' && <div className="space-y-3"><label className="block text-xs text-gray-300"><span className="mb-1 flex justify-between"><span>Opacidade</span><output>{opacity}%</output></span><input type="range" min="5" max="100" value={opacity} onChange={(event) => { setOpacity(Number(event.currentTarget.value)); clearGenerated(); }} className="w-full accent-brand-gold-500" /></label><label className="block text-xs text-gray-300">Tipo de mescla<select value={blendMode} onChange={(event) => { setBlendMode(event.currentTarget.value as BlendMode); clearGenerated(); }} className="mt-1 min-h-9 w-full border border-white/15 bg-[#222] px-2 text-sm text-white"><option value="multiply">Multiplicar</option><option value="normal">Normal</option><option value="overlay">Sobrepor</option><option value="soft-light">Luz suave</option></select></label></div>}
                            </section>}
                        </section>
                    </div>
                    <footer className="shrink-0 border-t border-white/10 bg-[#151515] p-3 sm:px-5">
                        {aiError && <p role="alert" className="mb-2 text-center text-xs text-red-300">{aiError}</p>}
                        <button
                            type="button"
                            onClick={() => { setQuoteError(''); setSavedQuote(null); setShowQuoteDialog(true); }}
                            className="min-h-12 w-full bg-green-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-green-500 sm:text-base"
                        >
                            Fazer orçamento pelo WhatsApp
                        </button>
                    </footer>
                </>
            )}
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={loadPhoto} className="sr-only" />
            <input ref={galleryInputRef} type="file" accept="image/*" onChange={loadPhoto} className="sr-only" />
            {showQuoteDialog && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4" onClick={() => !isSavingQuote && setShowQuoteDialog(false)}>
                <section role="dialog" aria-modal="true" aria-labelledby="quote-dialog-title" className="w-full max-w-md border border-brand-gold-500/30 bg-[#171717] p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
                    <h2 id="quote-dialog-title" className="font-cinzel text-xl text-brand-gold-400">Fazer orçamento</h2>
                    {savedQuote ? <div className="mt-4 space-y-4">
                        <p className="text-sm text-gray-300">Montagem salva para <strong className="text-white">{clientName}</strong>.</p>
                        <a href={savedQuote.url} target="_blank" rel="noopener noreferrer" className="block break-all text-sm text-brand-gold-400 underline underline-offset-4">Abrir montagem compartilhável</a>
                        <a href={savedQuote.whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-500">Continuar no WhatsApp</a>
                        <button type="button" onClick={() => setShowQuoteDialog(false)} className="w-full py-2 text-sm text-gray-400 hover:text-white">Fechar</button>
                    </div> : <form onSubmit={submitQuote} className="mt-4 space-y-4">
                        <label htmlFor="quote-client-name" className="block text-sm text-gray-300">Nome do cliente</label>
                        <input id="quote-client-name" autoFocus required maxLength={100} value={clientName} onChange={(event) => setClientName(event.currentTarget.value)} placeholder="Digite seu nome" className="min-h-11 w-full border border-white/20 bg-black px-3 text-white outline-none focus:border-brand-gold-500" />
                        {quoteError && <p role="alert" className="text-sm text-red-300">{quoteError}</p>}
                        <p className="text-xs text-gray-500">A montagem será salva para acompanhar o pedido pelo link enviado no WhatsApp.</p>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                            <button type="button" disabled={isSavingQuote} onClick={() => setShowQuoteDialog(false)} className="min-h-11 border border-white/20 px-3 text-sm text-gray-300 hover:border-white/40">Cancelar</button>
                            <button type="submit" disabled={isSavingQuote || !clientName.trim()} className="flex min-h-11 items-center justify-center gap-2 bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-50">{isSavingQuote && <SpinnerIcon className="h-4 w-4" />}{isSavingQuote ? 'Salvando...' : 'Salvar e continuar'}</button>
                        </div>
                    </form>}
                </section>
            </div>}
        </main>
    );
};

export default TattooSimulatorPage;