# Trem Da Hora (TDH) — Loja online

Site completo da loja Trem Da Hora: armarinho, decoração, moda, Trem Doce e Trem Salgado, além de solicitação de conserto (bainha, aperto, troca de zíper etc.).

## Como rodar localmente

1. Tenha o Node.js instalado (versão 22.5 ou superior).
2. Na pasta do projeto, rode: `node server.js`
3. Acesse a loja em: http://localhost:3000
4. Acesse o painel admin em: http://localhost:3000/admin.html (senha padrão: `tdh123` — troque isso antes de publicar de verdade, usando a variável de ambiente `ADMIN_KEY`)

## Produtos de exemplo

O banco já vem com produtos fictícios em cada categoria (Armarinho, Decoração, Moda, Trem Doce, Trem Salgado) só para você ver a loja funcionando. Troque pelos produtos reais direto no painel admin, aba "Produtos" — dá pra editar nome, descrição, preço, ícone e foto de cada um, ou excluir e criar novos.

## Solicitações de conserto

Ficam separadas dos pedidos de compra, numa aba própria do painel admin ("Consertos"). O cliente preenche nome, WhatsApp, tipo de serviço e descrição — não envolve pagamento nem carrinho, é só um pedido de orçamento que a loja responde depois por WhatsApp.

## Pagamento (Mercado Pago)

Mesma integração da versão anterior (Festa Encantada): sem a variável de ambiente `MP_ACCESS_TOKEN` configurada, o checkout funciona em modo simulado. Para ativar pagamento real, configure `MP_ACCESS_TOKEN` (e `SITE_URL` com a URL pública do site) nas variáveis de ambiente do serviço de hospedagem.

## Deploy

Mesmo processo já testado com a Festa Encantada: subir os arquivos para um repositório no GitHub e criar um Web Service no Render (Runtime: Node, Start Command: `node server.js`).
