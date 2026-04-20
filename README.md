# Mercado RESIDENCIAL ALTO DO PRATA

MVP web estático para apoiar compras no mini-mercado do condomínio quando o produto não aparece no app oficial do mercado. A página tem lista de produtos, sacola, Pix manual e envio do pedido pelo WhatsApp do administrador.

O objetivo é reduzir problemas na compra: se o morador procurar no app oficial e não encontrar o produto, ele usa esta página para localizar o item, pagar via Pix e enviar o pedido para conferência.

Ao abrir, o app mostra uma tela inicial explicando quando usar a página e o passo a passo: pesquisar, colocar na sacola, pagar via Pix, enviar no WhatsApp e mandar o comprovante.

## Como funciona para o morador

1. Escaneia o QR Code do mercado.
2. Usa esta página quando o produto não aparecer no app oficial.
3. Pesquisa e adiciona os produtos na sacola.
4. Confere o total da sacola.
5. Faz o Pix manualmente.
6. Clica em `Enviar pedido no WhatsApp`.
7. Envia o comprovante no WhatsApp.

O administrador confere o pedido, o comprovante e as câmeras do mercado manualmente.

## Estrutura

```text
App_Mercado/
├── index.html
├── styles.css
├── app.js
├── logo-inhouse-market.svg
├── produtos.csv
└── import_planogram.py
```

## Como testar localmente

Como a página lê `produtos.csv`, abra por um servidor local:

```powershell
python -m http.server 4173
```

Depois acesse:

```text
http://localhost:4173
```

Se não tiver Python, publique a pasta em uma hospedagem estática e teste pelo link publicado.

## Trocar Pix e WhatsApp

Edite o bloco `CONFIG` no começo de `app.js`:

```js
const CONFIG = {
  dataFile: "produtos.csv",
  adminWhatsApp: "5511999999999",
  pixKey: "pix@mercadinhodocondominio.com.br",
  receiverName: "Mercado RESIDENCIAL ALTO DO PRATA",
};
```

- `adminWhatsApp`: use código do país + DDD + número, somente números. Exemplo: `5511999999999`.
- `pixKey`: informe a chave Pix que o morador deve copiar.
- `receiverName`: nome que aparecerá na tela de pagamento.

## Trocar a base de produtos

O app usa o arquivo `produtos.csv`. Substitua esse arquivo pela planilha exportada em CSV, mantendo estes cabeçalhos:

```csv
Codigo de Barras;Nome do Produto;Status;Preço Final (consumidor);Qtd.Estoque;Data de vencimento
```

Regras da base:

- Só aparecem produtos com `Status` igual a `Desbloqueado`.
- Produtos com outro status ficam ocultos.
- O preço pode estar como `R$ 4,50`, `4,50` ou `4.50`.
- O código de barras é opcional. Se estiver vazio, o produto ainda aparece.
- Nesta primeira versão, estoque e vencimento ficam na base, mas não bloqueiam a venda.

No Excel ou Google Sheets, salve/exporte a planilha como CSV e coloque o arquivo novo em `produtos.csv`.

Se você receber a base em `.xlsx` no mesmo formato do planograma, também pode usar o conversor incluído:

```powershell
python import_planogram.py "C:\Users\JP_Desenvolvimento\Downloads\planogram-2026-03-02.xlsx" produtos.csv
```

Depois publique novamente a pasta do projeto. O app lê o CSV atualizado automaticamente quando a página carrega.

## Publicar gratuitamente

Opção simples com GitHub Pages:

1. Crie um repositório no GitHub.
2. Envie estes arquivos para o repositório.
3. Vá em `Settings > Pages`.
4. Em `Build and deployment`, selecione `Deploy from a branch`.
5. Escolha a branch principal e a pasta `/root`.
6. Salve e aguarde o GitHub gerar a URL pública.

Também funciona em hospedagens estáticas como Netlify, Vercel, Cloudflare Pages ou qualquer servidor que entregue arquivos HTML, CSS, JS e CSV.

## Gerar o QR Code

1. Copie a URL pública da aplicação.
2. Cole essa URL em um gerador de QR Code.
3. Baixe a imagem do QR Code.
4. Imprima e fixe no mini-mercado do condomínio.

O QR Code deve apontar para a URL publicada, não para um arquivo local do computador.
