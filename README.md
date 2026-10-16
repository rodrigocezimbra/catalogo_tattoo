Faça o download do projeto e abra com VS Code. Instale as dependências com `npm install` e inicie a interface com `npm run dev`.

## Orçamentos do simulador

Antes de usar o botão **Fazer orçamento pelo WhatsApp**:

1. Execute `supabase/migrations/202610120001_create_tattoo_quotes.sql` no SQL Editor do projeto Supabase. A migração cria a tabela privada `orcamentos_tatuagem` e o bucket público de imagens `orcamentos-tatuagem`.
2. Configure estas variáveis no ambiente do servidor Vercel. Não as coloque no código do navegador:
	- `SUPABASE_SERVICE_ROLE_KEY`: chave `service_role` do projeto Supabase.
	- `SUPABASE_URL`: URL do projeto Supabase. O endpoint usa a URL atual do projeto como padrão se esta variável não estiver definida.
	- `GEMINI_API_KEY`: chave da API Gemini usada pelo botão de simulação com IA.
3. Para testar a aplicação e os endpoints localmente, use `vercel dev --listen 0.0.0.0:3000` com o projeto Vercel vinculado e as variáveis disponíveis no ambiente local.

No celular conectado à mesma rede, abra `http://192.168.2.88:3000` enquanto o servidor local estiver ativo. A montagem é salva apenas quando o cliente confirma o envio do orçamento; o link público usa um identificador aleatório e exibe somente os dados daquele orçamento.
