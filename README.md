# 💰 Sistema Financeiro LHSC — v9

Sistema de controle financeiro pessoal, funciona **offline e online** com sincronização Firebase opcional.

---

## ✨ Funcionalidades

- 📊 Dashboard com KPIs, gráficos e top 10 gastos
- 💸 Controle de Despesas realizadas
- 📅 Contas a Pagar (fixas, parceladas, variáveis, únicas)
- 📥 Receitas com histórico
- 💳 Gestão de Cartões de Crédito
- 🏷️ Categorias e Tipos de Pagamento personalizáveis
- 🎯 Metas mensais por categoria
- 🔄 **Offline First** — funciona sem internet
- ☁️ **Sincronização Firebase** (opcional) — dados na nuvem
- 📱 **PWA** — instalável no celular e desktop

---

## 🚀 Como usar

### 1. Clonar o repositório
```bash
git clone https://github.com/SEU_USUARIO/sis-finan.git
cd sis-finan
```

### 2. Abrir localmente
Basta abrir o `index.html` no navegador. Ou usar um servidor local:
```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```
Acesse: `http://localhost:8080`

### 3. Login padrão
- **Usuário:** `lhsc`
- **Senha:** `123`

---

## ☁️ Configurar Firebase (opcional)

Para sincronização entre dispositivos:

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Crie um projeto
3. Ative **Authentication → Método de login → Anônimo**
4. Crie o **Firestore Database** (modo produção ou teste)
5. Vá em **Configurações do projeto → Seus apps → Web** e copie as chaves
6. Edite o arquivo `firebase-config.js` e cole suas chaves:

```javascript
const FIREBASE_CONFIG = {
    apiKey:            "sua-api-key",
    authDomain:        "seu-projeto.firebaseapp.com",
    projectId:         "seu-projeto",
    storageBucket:     "seu-projeto.firebasestorage.app",
    messagingSenderId: "123456789",
    appId:             "1:123456789:web:abcdef"
};

const FIREBASE_ENABLED = true; // ← mude para true!
```

> ⚠️ **Segurança:** Nunca faça commit do `firebase-config.js` com chaves reais em repositório público. Adicione-o ao `.gitignore` se necessário.

---

## 📡 Modo Offline / Online

| Situação | Comportamento |
|---|---|
| **Online, sem Firebase** | Dados salvos no `localStorage` do navegador |
| **Online, com Firebase** | Dados sincronizados automaticamente na nuvem |
| **Offline** | Funciona normalmente. Dados salvos localmente. |
| **Volta online** | Sincroniza automaticamente os dados pendentes |

O usuário é notificado em todos os cenários por uma barra de status na parte inferior da tela.

---

## 📦 Estrutura de arquivos

```
/
├── index.html          # Interface principal
├── app.js              # Lógica da aplicação + módulo Firebase
├── style.css           # Estilos
├── sw.js               # Service Worker (cache offline)
├── manifest.json       # Manifesto PWA
├── firebase-config.js  # ⚙️ Configuração Firebase (edite aqui!)
├── .gitignore
└── README.md
```

---

## 🛠️ Tecnologias

- HTML5 + CSS3 + JavaScript (Vanilla)
- [Chart.js](https://www.chartjs.org/) — gráficos
- [Font Awesome 6](https://fontawesome.com/) — ícones
- [Firebase 10](https://firebase.google.com/) — autenticação e banco de dados (opcional)
- Service Worker — cache e suporte offline
- PWA — Progressive Web App

---

## 📱 Instalar como app (PWA)

**No celular (Chrome/Android):**
Abra o sistema no navegador → Menu → "Adicionar à tela inicial"

**No desktop (Chrome):**
Ícone de instalação na barra de endereços → "Instalar"

---

## 🔄 Deploy no GitHub Pages

1. Vá em **Settings → Pages**
2. Source: `main` / `root`
3. Aguarde o deploy e acesse `https://SEU_USUARIO.github.io/sis-finan/`

---

## 📄 Licença

Uso pessoal. Todos os direitos reservados.
