import type { IncomingMessage, ServerResponse } from 'node:http';

interface SimulatorRequest extends IncomingMessage {
    body?: unknown;
}

interface ImageInput {
    mimeType: string;
    data: string;
}

interface SimulatorBody {
    photo?: string;
    tattoo?: string;
    placement?: {
        x?: number;
        y?: number;
        widthPercent?: number;
    };
}

const readImage = (value: unknown): ImageInput | null => {
    if (typeof value !== 'string') return null;
    const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return null;
    return { mimeType: match[1], data: match[2] };
};

const respond = (response: ServerResponse, status: number, payload: unknown) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(payload));
};

interface QuoteBody {
    name?: string;
    image?: string;
    productId?: number;
    productName?: string;
}

export const handleQuote = async (request: SimulatorRequest, response: ServerResponse) => {
    const url = process.env.SUPABASE_URL || 'https://pvjcpgvkmolgtvdaqlzi.supabase.co';
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) return respond(response, 503, { error: 'O salvamento de orçamentos não está configurado no servidor.' });

    if (request.method === 'GET') {
        const quoteId = new URL(request.url || '/', 'http://localhost').searchParams.get('id') || '';
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(quoteId)) {
            return respond(response, 400, { error: 'Link de orçamento inválido.' });
        }
        const lookup = await fetch(`${url}/rest/v1/orcamentos_tatuagem?id=eq.${quoteId}&select=client_name,product_name,image_path,created_at`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        if (!lookup.ok) return respond(response, 502, { error: 'Não foi possível carregar este orçamento.' });
        const [quote] = await lookup.json() as Array<{ client_name: string; product_name: string; image_path: string; created_at: string }>;
        if (!quote) return respond(response, 404, { error: 'Orçamento não encontrado.' });
        return respond(response, 200, {
            name: quote.client_name,
            productName: quote.product_name,
            image: `${url}/storage/v1/object/public/orcamentos-tatuagem/${quote.image_path}`,
            createdAt: quote.created_at,
        });
    }

    if (request.method !== 'POST') {
        response.setHeader('Allow', 'GET, POST');
        return respond(response, 405, { error: 'Método não permitido.' });
    }
    let body = request.body as QuoteBody | undefined;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body) as QuoteBody;
        } catch {
            return respond(response, 400, { error: 'Não foi possível ler os dados enviados.' });
        }
    }
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : '';
    const image = readImage(body?.image);
    const productId = Number(body?.productId);
    const productName = typeof body?.productName === 'string' ? body.productName.trim().slice(0, 160) : '';
    if (!name) return respond(response, 400, { error: 'Informe o nome do cliente.' });
    if (!image || !['image/png', 'image/jpeg'].includes(image.mimeType)) return respond(response, 400, { error: 'A montagem precisa ser uma imagem PNG ou JPEG.' });
    if (image.data.length > 4_000_000) return respond(response, 413, { error: 'A montagem ficou grande demais. Tente uma foto menor.' });

    const quoteId = crypto.randomUUID();
    const extension = image.mimeType === 'image/png' ? 'png' : 'jpg';
    const imagePath = `${quoteId}.${extension}`;
    const storageResponse = await fetch(`${url}/storage/v1/object/orcamentos-tatuagem/${imagePath}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': image.mimeType, 'x-upsert': 'false' },
        body: Buffer.from(image.data, 'base64'),
    });
    if (!storageResponse.ok) {
        console.error('Quote image upload failed:', storageResponse.status, await storageResponse.text());
        return respond(response, 502, { error: 'Não foi possível salvar a montagem.' });
    }
    const rowResponse = await fetch(`${url}/rest/v1/orcamentos_tatuagem`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({
            id: quoteId,
            client_name: name,
            product_id: Number.isInteger(productId) ? productId : null,
            product_name: productName || 'Tatuagem personalizada',
            image_path: imagePath,
        }),
    });
    if (!rowResponse.ok) {
        console.error('Quote record insert failed:', rowResponse.status, await rowResponse.text());
        await fetch(`${url}/storage/v1/object/orcamentos-tatuagem/${imagePath}`, {
            method: 'DELETE',
            headers: { apikey: key, Authorization: `Bearer ${key}` },
        });
        return respond(response, 502, { error: 'Não foi possível registrar o orçamento.' });
    }
    return respond(response, 201, { id: quoteId });
};

export default async function handler(request: SimulatorRequest, response: ServerResponse) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return respond(response, 405, { error: 'Método não permitido.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return respond(response, 503, { error: 'A geração por IA ainda não está configurada no servidor.' });

    let body = request.body as SimulatorBody | undefined;
    if (typeof body === 'string') {
        try {
            body = JSON.parse(body) as SimulatorBody;
        } catch {
            return respond(response, 400, { error: 'Não foi possível ler os dados enviados.' });
        }
    }

    const photo = readImage(body?.photo);
    const tattoo = readImage(body?.tattoo);
    if (!photo || !tattoo) return respond(response, 400, { error: 'Envie uma foto e uma imagem de tatuagem válidas.' });
    if (photo.data.length > 8_000_000 || tattoo.data.length > 4_000_000) {
        return respond(response, 413, { error: 'As imagens são grandes demais. Escolha arquivos menores.' });
    }

    const x = Math.max(0, Math.min(100, Number(body?.placement?.x) || 50));
    const y = Math.max(0, Math.min(100, Number(body?.placement?.y) || 50));
    const width = Math.max(5, Math.min(90, Number(body?.placement?.widthPercent) || 28));
    const prompt = `Create a realistic tattoo try-on using the first image as the exact base photograph and the second image as the tattoo artwork. Place the artwork centered around ${x}% from the left and ${y}% from the top of the photo; its width should be approximately ${width}% of the photo width. Make the design follow the skin's perspective and contours, with natural ink integration and skin texture visible through it. Preserve the original photograph, body, skin tone, lighting, background, and framing exactly; do not change or add anything else. Do not add text, borders, or watermarks. Return one edited image.`;

    try {
        const generationResponse = await fetch(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey,
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { inlineData: { mimeType: photo.mimeType, data: photo.data } },
                            { inlineData: { mimeType: tattoo.mimeType, data: tattoo.data } },
                            { text: prompt },
                        ],
                    }],
                    generationConfig: { responseModalities: ['IMAGE'] },
                }),
                signal: AbortSignal.timeout(90_000),
            },
        );

        if (!generationResponse.ok) {
            console.error('Gemini image generation failed:', generationResponse.status, await generationResponse.text());
            return respond(response, 502, { error: 'A IA não conseguiu gerar a prévia. Tente novamente.' });
        }

        const result = await generationResponse.json() as {
            candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> } }>;
        };
        const generatedImage = result.candidates?.flatMap((candidate) => candidate.content?.parts || [])
            .find((part) => part.inlineData?.data)?.inlineData;

        if (!generatedImage?.data) return respond(response, 502, { error: 'A IA não retornou uma imagem. Tente novamente.' });
        return respond(response, 200, { image: `data:${generatedImage.mimeType || 'image/png'};base64,${generatedImage.data}` });
    } catch (error) {
        console.error('Tattoo simulation request failed:', error);
        return respond(response, 502, { error: 'Falha ao conectar com a IA. Tente novamente.' });
    }
}