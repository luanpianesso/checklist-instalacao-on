# Checklist de Instalação — ON Engenharia

App web (PWA) para preenchimento em campo do checklist de instalação de sistemas fotovoltaicos, no celular do executor.

## O que faz

- Réplica em formato digital do checklist de instalação em papel (todas as seções: dados do local, sistema instalado, material CA/CC, kit fotovoltaico, testes, registros fotográficos).
- Captura a geolocalização do local de instalação (um toque).
- Fotos gerais (livres) além das fotos obrigatórias por categoria (padrão de entrada, inversor, módulos, aterramento, etc.).
- Campo de login/senha do aplicativo de monitoramento — também disponível como campo editável dentro do PDF final, para atualização posterior.
- Salvamento automático a cada alteração (IndexedDB no próprio aparelho): o executor pode fechar o app e continuar de onde parou, mesmo sem internet.
- Observações em texto e em áudio (gravação pelo microfone do celular).
- Assinatura do executor por toque na tela.
- Ao finalizar, gera um PDF completo (com fotos, assinatura, geolocalização e anexos de áudio) e empacota tudo em um `.zip`, pronto para compartilhar (WhatsApp, e-mail, etc.) ou baixar.

## Rodando localmente

Pré-requisito: [Node.js](https://nodejs.org) instalado.

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (ex: `http://localhost:5173`) no navegador do celular (mesma rede Wi-Fi) ou no computador para testar.

> **Nota:** se este projeto estiver dentro de uma pasta sincronizada pelo Google Drive, o `npm install` pode ficar muito lento (o sincronizador do Drive intercepta cada arquivo criado). Se isso acontecer, rode `npm install` em uma cópia local (fora do Drive) e copie a pasta `node_modules` gerada para dentro deste projeto.

## Gerando a versão de produção

```bash
npm run build
```

Isso cria a pasta `dist/` com o app pronto para publicar em qualquer hospedagem estática (Netlify, Vercel, GitHub Pages, ou até um servidor interno). Depois de publicado, o executor abre o link uma vez e pode "instalar" o app na tela inicial do celular (PWA) — a partir daí funciona mesmo offline.

## Estrutura

- `src/schema.js` — definição de todos os campos do checklist (fácil de ajustar textos/opções).
- `src/db.js` — armazenamento local (IndexedDB): instalações + mídia (fotos, áudios, assinatura).
- `src/main.js` — telas (lista de instalações / formulário) e toda a lógica de interação.
- `src/pdf.js` — geração do PDF final (layout, fotos, campos editáveis, anexos de áudio).
- `src/zip.js` — empacotamento do PDF + fotos + áudios em `.zip` e compartilhamento/download.
- `src/signature.js`, `src/audio.js`, `src/geo.js` — assinatura por toque, gravação de áudio e geolocalização.

## Personalização

Para ajustar textos, seções ou opções do checklist, edite `src/schema.js`. Para ajustar cores/identidade visual, edite as variáveis no topo de `src/style.css` (`--navy-900`, `--cyan-400`, etc.) e o cabeçalho do PDF em `src/pdf.js`.
