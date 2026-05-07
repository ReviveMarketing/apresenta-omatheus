# ReVive · Indicadores BSC

Dashboard executivo para apresentação mensal de indicadores comerciais e de marketing ao CEO.

## ✨ O que está dentro

- **Visão Geral (cockpit)** — KPIs principais, globo 3D com fechamentos, funil do mês, top cidades, evolução 12 meses, distribuição por origem
- **Comercial** — registro de fechamentos (digital e indicação) com filtros por status, origem, cidade, consultor, tipo
- **Marketing** — investimento em tráfego (META / GOOGLE / VAGAS), leads, CPL, qualificados, fechados, CAC, seguidores em todos os canais, comentários positivos no Google
- **Mapa de Fechamentos** — globo 3D interativo (girar com mouse, zoom com scroll) mostrando todas as cidades onde houve venda, com pontos pulsantes coloridos por tipo (verde = digital, âmbar = indicação)

## 🚀 Como usar localmente

Basta abrir o arquivo `index.html` no navegador. Não precisa servidor.

## ☁️ Como hospedar no GitHub Pages

1. **Crie um repositório no GitHub** — pode ser público ou privado (Pages funciona em ambos com conta gratuita)
2. **Faça upload de todos estes arquivos** para o repositório (ou use `git push`):
   ```
   index.html
   README.md
   assets/css/main.css
   assets/js/data.js
   assets/js/store.js
   assets/js/globe.js
   assets/js/charts.js
   assets/js/app.js
   ```
3. **Ative o GitHub Pages**:
   - No repositório, vá em **Settings** (engrenagem no topo)
   - No menu lateral esquerdo, clique em **Pages**
   - Em **Source**, escolha:
     - Branch: **main** (ou `master`)
     - Folder: **/ (root)**
   - Clique em **Save**
4. **Aguarde 1–2 minutos** e a URL aparecerá no topo da mesma página, no formato:
   ```
   https://SEU-USUARIO.github.io/NOME-DO-REPO/
   ```

## 💾 Sobre os dados

- Os dados são salvos no **LocalStorage do navegador** — ficam apenas no seu computador, ninguém mais vê.
- Se você acessar de outro PC, os dados não vêm junto (eles são por navegador).
- Use o botão de **download** (no topo, ao lado de "Editar") para exportar um backup `.json`.
- Use o botão de **upload** para restaurar um backup ou levar os dados pra outro PC.

## ✏️ Como atualizar os dados

- **Adicionar um fechamento** → aba "Comercial" → botão **Novo Fechamento**
- **Editar / remover** → na tabela da aba "Comercial", use os ícones de lápis e lixeira em cada linha
- **Atualizar marketing do mês** → no topo, escolha o mês/ano desejado, depois clique em **Editar**
- **Mudar de mês** para visualizar dados antigos → use os seletores **Mês** e **Ano** no topo

## 🎨 Detalhes técnicos

- HTML + CSS + JavaScript puros (sem build, sem dependências de servidor)
- Three.js (CDN) para o globo 3D
- Tipografia: Inter Tight + Fraunces + JetBrains Mono (Google Fonts)
- Compatível com Chrome, Edge, Firefox e Safari modernos
