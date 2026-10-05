# Firebase Chat — CP2 Mobile

Aplicativo de chat desenvolvido em **React Native com Expo e TypeScript**, utilizando serviços do Firebase para autenticação, persistência de dados, mensagens em tempo real e notificações push.

O projeto permite conversas individuais e em grupo entre usuários autenticados, gerenciamento de integrantes, limite configurável de membros, envio de mensagens direcionadas e diferentes políticas de notificação.

---

## Integrantes


- RM557959 — Henrique Borges de Castro Sanches
- RM556439 — Douglas dos Santos Melo 
- RM556506 — Nicolas Caciolato reis
- RM556332 — Matheus Marcelino Dantas da Silva

---


## API pública

A API responsável pelo envio seguro das notificações está publicada no Render:

https://cp2-mobile.onrender.com

### Verificação da API

Endpoint de health check:

```text
GET https://cp2-mobile.onrender.com/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "timestamp": "..."
}
```

Também é possível verificar a raiz:

```text
GET https://cp2-mobile.onrender.com
```

Resposta:

```json
{
  "name": "Firebase Chat API",
  "status": "online"
}
```

---

# Tecnologias utilizadas

## Mobile

- React Native
- Expo
- Expo Router
- TypeScript
- Firebase SDK
- Expo Notifications
- Expo Image Picker
- AsyncStorage

## Firebase

- Firebase Authentication
- Cloud Firestore
- Firebase Realtime Database
- Firebase Cloud Messaging — FCM
- Firebase Admin SDK

## Backend

- Node.js
- Express
- TypeScript
- Firebase Admin SDK
- Expo Server SDK
- Render

## Armazenamento de imagens

- Cloudinary

---

# Expo

O projeto utiliza **Expo SDK 57**, atendendo ao requisito de Expo SDK 55 ou superior.

O aplicativo utiliza Development Build para permitir o funcionamento correto das notificações push e das configurações nativas necessárias.

---

# Funcionalidades

## Autenticação

A autenticação utiliza exclusivamente **e-mail e senha**, através do Firebase Authentication.

Funcionalidades disponíveis:

- cadastro;
- login;
- recuperação da sessão;
- logout;
- tratamento de credenciais inválidas.

Durante o cadastro são informados:

- nome;
- e-mail;
- senha;
- número de celular;
- data de nascimento;
- foto de perfil.

Não são utilizados:

- Google Login;
- Apple Login;
- autenticação anônima;
- usuários hardcoded.

---

# Perfil dos usuários

Os perfis são armazenados no Cloud Firestore.

Estrutura utilizada:

```text
users/{uid}
```

Exemplo:

```text
name
email
phoneNumber
birthDate
photoUrl
createdAt
```

A foto do usuário é enviada ao Cloudinary.

Somente a URL final da imagem é armazenada no Firestore.

Nenhuma imagem em Base64 é armazenada no Firestore ou no Realtime Database.

---

# Conversas individuais

O aplicativo permite iniciar conversas entre dois usuários.

Cada conversa individual:

- possui exatamente dois participantes;
- impede conversa do usuário consigo mesmo;
- não permite duplicar uma conversa do mesmo par;
- permite visualizar o perfil do outro participante.

O identificador da conversa é criado utilizando os dois UIDs ordenados, garantindo uma conversa única por par de usuários.

Estrutura no Firestore:

```text
directConversations/{conversationId}
```

Exemplo:

```json
{
  "id": "uidA_uidB",
  "type": "direct",
  "participantIds": [
    "uidA",
    "uidB"
  ],
  "createdAt": 0
}
```

---

# Grupos

O aplicativo permite criar e gerenciar grupos.

Cada grupo possui:

- nome;
- foto;
- proprietário;
- lista de integrantes;
- limite máximo de integrantes;
- política de notificações;
- data de criação;
- data de atualização.

Estrutura:

```text
groups/{groupId}
```

Exemplo:

```json
{
  "id": "groupId",
  "name": "Nome do grupo",
  "photoUrl": "https://...",
  "ownerId": "uid",
  "memberIds": [
    "uid1",
    "uid2"
  ],
  "memberLimit": 5,
  "notificationPolicy": "all_group_messages",
  "createdAt": 0,
  "updatedAt": 0
}
```

---

# Gerenciamento de grupo

Somente o proprietário pode gerenciar as configurações do grupo.

O proprietário pode:

- alterar o nome;
- alterar a foto;
- alterar o limite de integrantes;
- alterar a política de notificações;
- adicionar integrantes;
- remover integrantes.

O proprietário não pode remover a si próprio.

O grupo deve continuar possuindo pelo menos dois integrantes.

---

# Limite configurável de integrantes

Cada grupo possui a propriedade:

```text
memberLimit
```

O limite:

- é definido na criação;
- deve ser inteiro;
- deve ser igual ou maior que 2;
- não pode ser menor que a quantidade atual de integrantes;
- impede novas entradas quando estiver cheio.

A interface também apresenta:

- quantidade atual de integrantes;
- limite máximo;
- quantidade de vagas disponíveis.

---

# Proteção contra concorrência

A adição de integrantes utiliza transações do Cloud Firestore através de:

```ts
runTransaction()
```

Dentro da transação são verificados novamente:

- grupo existente;
- usuário proprietário;
- quantidade atual de integrantes;
- limite configurado;
- usuário já pertencente ao grupo.

Dessa maneira, duas tentativas simultâneas de inclusão não conseguem ultrapassar o limite.

Caso duas operações tentem modificar o mesmo grupo simultaneamente, o Firestore detecta a alteração concorrente e executa novamente a transação utilizando os dados mais recentes.

Além disso, as regras do Firestore verificam:

```text
memberIds.size() <= memberLimit
```

Portanto, a proteção não depende apenas da interface.

---

# Mensagens

Todas as mensagens são persistidas no **Firebase Realtime Database**.

Estrutura:

```text
messages
  └── conversationId
       └── messageId
            ├── id
            ├── conversationId
            ├── conversationType
            ├── senderId
            ├── text
            ├── target
            ├── mentionedUserIds
            └── createdAt
```

Modelo utilizado:

```ts
type MessageTarget =
  | {
      type: 'conversation';
    }
  | {
      type: 'member';
      memberId: string;
    };

type ChatMessage = {
  id: string;
  conversationId: string;
  conversationType: 'direct' | 'group';
  senderId: string;
  text: string;
  target: MessageTarget;
  mentionedUserIds: string[];
  createdAt: number;
};
```

---

# Mensagens direcionadas

Dentro de um grupo o usuário pode enviar:

### Mensagem geral

```json
{
  "target": {
    "type": "conversation"
  },
  "mentionedUserIds": []
}
```

### Mensagem direcionada

O usuário pode selecionar explicitamente um integrante:

```json
{
  "target": {
    "type": "member",
    "memberId": "UID_DO_USUARIO"
  },
  "mentionedUserIds": [
    "UID_DO_USUARIO"
  ]
}
```

A mensagem continua pertencendo ao histórico do grupo, porém a política de notificações determina quem receberá o push.

---

# Atualização em tempo real

O Firebase Realtime Database utiliza listeners em tempo real.

Fluxo:

```text
Usuário envia mensagem
        ↓
Realtime Database salva
        ↓
Listener detecta alteração
        ↓
Interface atualiza automaticamente
```

Não é necessário:

- atualizar a página;
- reabrir a conversa;
- pressionar botão para atualizar.

Os listeners são removidos quando a tela é desmontada.

---

# Firebase Authentication

Responsável por:

- criação de contas;
- login;
- recuperação de sessão;
- identificação através do UID;
- geração do Firebase ID Token;
- logout.

---

# Cloud Firestore

Responsável por:

- perfis;
- conversas individuais;
- grupos;
- integrantes;
- limite de integrantes;
- proprietário;
- política de notificações;
- tokens dos dispositivos.

---

# Firebase Realtime Database

Responsável por:

- mensagens individuais;
- mensagens de grupos;
- atualização em tempo real;
- listeners das conversas abertas.

---

# Firebase Cloud Messaging

O Firebase Cloud Messaging é utilizado para permitir a entrega das notificações no Android.

O projeto utiliza Expo Notifications em conjunto com FCM.

No Android foi configurado:

```text
google-services.json
```

O Firebase Cloud Messaging V1 também foi configurado para o projeto.

---

# Registro do dispositivo

Ao autenticar um usuário, o aplicativo solicita permissão de notificações.

Após autorização, é obtido um Expo Push Token.

O token é armazenado em:

```text
users/{uid}/devices/{deviceId}
```

Estrutura:

```json
{
  "token": "ExponentPushToken[...]",
  "platform": "android",
  "enabled": true,
  "updatedAt": 0
}
```

O identificador do dispositivo é derivado utilizando hash para evitar utilizar o token diretamente como ID do documento.

---

# Políticas de notificações

Cada grupo possui uma das quatro políticas obrigatórias.

## all_group_messages

Todos os integrantes do grupo recebem push, exceto o remetente.

```text
all_group_messages
```

---

## mentioned_members

Somente usuários explicitamente selecionados ou mencionados recebem push.

```text
mentioned_members
```

A API utiliza:

```text
mentionedUserIds
```

e também o integrante definido em:

```text
target.memberId
```

---

## direct_messages_only

Mensagens de grupo não geram push.

Conversas individuais continuam gerando notificações.

```text
direct_messages_only
```

---

## disabled

Nenhuma mensagem daquela conversa gera push.

```text
disabled
```

---

# API de notificações

O envio de notificações **não é realizado diretamente pelo aplicativo**.

Existe uma API separada:

```text
server/
```

Tecnologias:

- Node.js;
- Express;
- TypeScript;
- Firebase Admin SDK;
- Expo Server SDK.

A API está publicada em:

```text
https://cp2-mobile.onrender.com
```

---

# Fluxo da notificação

```text
Usuário envia mensagem
        ↓
Aplicativo salva no Realtime Database
        ↓
Aplicativo obtém Firebase ID Token
        ↓
Aplicativo chama a API
        ↓
API valida Firebase ID Token
        ↓
API consulta mensagem no Realtime Database
        ↓
API verifica remetente
        ↓
API consulta Firestore
        ↓
API identifica participantes e política
        ↓
API calcula destinatários
        ↓
API envia push
```

O aplicativo não envia uma lista de destinatários para a API.

A decisão de quem recebe a notificação é realizada no servidor.

---

# Endpoint de notificação

```http
POST /notifications/messages
```

Header:

```http
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

Body:

```json
{
  "conversationId": "conversation-id",
  "messageId": "message-id"
}
```

---

# Proteção contra notificações duplicadas

A API possui controle de idempotência.

Antes de realizar o envio, é criado/verificado um registro em:

```text
notificationDispatches
```

A identificação é baseada em:

```text
conversationId + messageId
```

Caso uma mesma requisição seja enviada novamente, a mensagem não deve gerar notificações duplicadas.

---

# Validação da API

A API não confia apenas nos dados enviados pelo aplicativo.

Ela verifica:

1. Firebase ID Token;
2. usuário autenticado;
3. existência da mensagem no Realtime Database;
4. senderId da mensagem;
5. conversa relacionada;
6. participantes;
7. integrantes do grupo;
8. política de notificações;
9. tokens habilitados.

Somente após essas validações o envio é realizado.

---

# Tokens inválidos

A API valida os tokens antes do envio.

Tokens inválidos ou dispositivos identificados como não registrados podem ser desativados para impedir novas tentativas de entrega para o mesmo token.

---

# Payload da notificação

O payload contém dados suficientes para identificar a conversa:

```json
{
  "conversationId": "...",
  "conversationType": "direct"
}
```

ou:

```json
{
  "conversationId": "...",
  "conversationType": "group"
}
```

Esses dados permitem direcionar o usuário para a conversa relacionada ao tocar na notificação.

---

# Armazenamento de imagens

Foi utilizado o **Cloudinary**.

Cloud Name:

```text
z7ohm9hr
```

Unsigned Upload Preset:

```text
firebase_chat_profiles
```

Pastas utilizadas:

```text
firebase-chat/profiles
firebase-chat/groups
```

Fluxo:

```text
Usuário seleciona imagem
        ↓
Aplicativo solicita permissão
        ↓
Imagem é enviada ao Cloudinary
        ↓
Cloudinary retorna URL HTTPS
        ↓
Somente URL é salva no Firestore
```

---

# Estrutura do projeto

```text
FirebaseChat/
│
├── assets/
│
├── server/
│   ├── src/
│   │   ├── middleware/
│   │   │   └── authenticate.ts
│   │   │
│   │   ├── routes/
│   │   │   └── notifications.ts
│   │   │
│   │   ├── services/
│   │   │   ├── firebaseAdmin.ts
│   │   │   ├── notificationSender.ts
│   │   │   └── recipientResolver.ts
│   │   │
│   │   ├── app.ts
│   │   └── types.ts
│   │
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   └── (app)/
│   │
│   ├── contexts/
│   │   └── AuthContext.tsx
│   │
│   ├── services/
│   │   ├── authService.ts
│   │   ├── chatService.ts
│   │   ├── cloudinaryService.ts
│   │   ├── firebase.ts
│   │   ├── groupService.ts
│   │   ├── notificationApiService.ts
│   │   ├── notificationService.ts
│   │   └── userService.ts
│   │
│   ├── types/
│   └── utils/
│
├── app.json
├── eas.json
├── firebaseConfig.json
├── firestore.rules
├── database.rules.json
├── google-services.json
├── package.json
└── README.md
```

---

# Instalação

Clone o projeto:

```bash
git clone https://github.com/eurick-en/cp2-mobile.git
```

Entre na pasta:

```bash
cd cp2-mobile
```

Instale as dependências:

```bash
npm install
```

---

# Executando o aplicativo

O projeto utiliza Development Build.

Para iniciar:

```bash
npx expo start --dev-client
```

Caso seja necessário limpar o cache:

```bash
npx expo start --dev-client -c
```

---

# Verificação TypeScript

Execute:

```bash
npx tsc --noEmit
```

O projeto utiliza TypeScript com modo estrito.

É proibida a utilização de:

```ts
any
```

---

# Firebase Client

O arquivo:

```text
firebaseConfig.json
```

contém apenas a configuração pública necessária para inicialização do Firebase SDK cliente.

Ele não contém:

- Firebase Admin SDK;
- private key;
- service account;
- senha;
- token administrativo.

---

# Firebase Admin

As credenciais administrativas são utilizadas exclusivamente pela API.

Variáveis necessárias:

```env
FIREBASE_PROJECT_ID=seu-project-id
FIREBASE_CLIENT_EMAIL=email-da-service-account
FIREBASE_PRIVATE_KEY=CONFIGURAR_APENAS_NA_HOSPEDAGEM
FIREBASE_DATABASE_URL=https://seu-projeto-default-rtdb.firebaseio.com
```

Os valores reais não são versionados.

---

# Variáveis da API

Arquivo:

```text
server/.env.example
```

Exemplo:

```env
PORT=3000

FIREBASE_PROJECT_ID=seu-project-id

FIREBASE_CLIENT_EMAIL=email-da-conta-de-servico

FIREBASE_PRIVATE_KEY=CONFIGURAR_APENAS_NA_HOSPEDAGEM

FIREBASE_DATABASE_URL=https://seu-projeto-default-rtdb.firebaseio.com
```

O arquivo real:

```text
server/.env
```

não é enviado ao GitHub.

---

# Executando a API localmente

Entre na pasta:

```bash
cd server
```

Instale:

```bash
npm install
```

Execute em desenvolvimento:

```bash
npm run dev
```

API local:

```text
http://localhost:3000
```

Health:

```text
http://localhost:3000/health
```

---

# Build da API

```bash
npm run build
```

Depois:

```bash
npm start
```

---

# Deploy

A API foi publicada utilizando o **Render**.

Configuração:

```text
Root Directory:
server
```

Build:

```bash
npm install && npm run build
```

Start:

```bash
npm start
```

Health Check:

```text
/health
```

As credenciais administrativas são configuradas diretamente nas Environment Variables do Render.

Nenhuma private key é mantida no GitHub.

---

# Android

O Android utiliza:

```text
com.henriquesanches.firebasechat
```

O projeto contém:

```text
google-services.json
```

O Firebase Cloud Messaging V1 está configurado.

O aplicativo foi executado utilizando Development Build em ambiente Android compatível.

Para gerar um Development Build:

```bash
eas build --profile development --platform android
```

Depois:

```bash
npx expo start --dev-client
```

---

# iOS

O projeto utiliza configuração compatível com Expo/iOS.

Bundle Identifier:

```text
com.henriquesanches.firebasechat
```

Para notificações push no iOS é necessário:

- Apple Developer Account;
- configuração APNs;
- credenciais configuradas no EAS;
- build nativo/development build;
- dispositivo ou ambiente compatível.

Build:

```bash
eas build --profile development --platform ios
```

Após configurar corretamente as credenciais APNs, o fluxo de notificações utiliza o mesmo serviço da aplicação e a mesma API.

> A validação principal realizada durante o desenvolvimento foi feita no ambiente Android.

---

# Hooks

O projeto utiliza os hooks obrigatórios com finalidade real:

```text
useState
useEffect
useMemo
useCallback
```

Exemplos de utilização:

- formulário e estado das telas;
- listeners do Firebase;
- carregamento de usuários;
- listas derivadas;
- filtros;
- membros disponíveis;
- callbacks de envio;
- autenticação.

---

# TypeScript

O projeto utiliza tipagem para:

- usuários;
- mensagens;
- grupos;
- conversas;
- notificações;
- propriedades;
- estados;
- services;
- retornos;
- parâmetros.

O projeto não utiliza `any`.

---

# Estados da interface

São tratados cenários como:

- loading;
- erro de autenticação;
- nenhum usuário;
- nenhuma conversa;
- nenhuma mensagem;
- grupo cheio;
- erro ao adicionar membro;
- usuário sem permissão;
- falha ao enviar mensagem;
- permissão de notificação negada;
- token indisponível;
- erro de conexão.

---

# Segurança do Firestore

As regras estão versionadas em:

```text
firestore.rules
```

As regras contemplam:

- autenticação obrigatória;
- usuário alterando apenas seus próprios dados quando aplicável;
- proprietário como responsável por alterações de grupo;
- mínimo de dois membros;
- proprietário permanecendo entre os integrantes;
- limite de integrantes;
- validação das políticas permitidas;
- tokens de dispositivos protegidos.

---

# Segurança do Realtime Database

As regras estão versionadas em:

```text
database.rules.json
```

As mensagens verificam:

- autenticação;
- senderId igual ao UID autenticado;
- conversationId correspondente;
- tipo de conversa válido;
- tamanho do texto;
- estrutura mínima da mensagem.

Como algumas validações dependem simultaneamente de dados do Firestore e do Realtime Database, as validações críticas relacionadas ao envio de notificações também são realizadas pela API utilizando Firebase Admin SDK.

---

# Logout

Ao realizar logout:

- Firebase Authentication encerra a sessão;
- estado do usuário é limpo;
- aplicação retorna à autenticação;
- telas protegidas deixam de ser acessíveis;
- listeners vinculados às telas são removidos quando desmontados.

---

# Telas

O aplicativo possui:

- Login;
- Cadastro;
- Conversas;
- Usuários;
- Criação de grupo;
- Gerenciamento de grupo;
- Informações do grupo;
- Chat individual;
- Chat de grupo;
- Perfil.

---

# Prints

## Login


<img width="378" height="782" alt="image" src="https://github.com/user-attachments/assets/1308e493-7d70-4c2a-8538-50b5d85a3b00" />


## Cadastro

<img width="345" height="773" alt="image" src="https://github.com/user-attachments/assets/ff8cb837-f9f9-4a44-9e93-8f2fe3ed9f5a" />


## Conversas

<img width="365" height="772" alt="image" src="https://github.com/user-attachments/assets/fdf95603-e889-43bd-bdde-f9a87f30e29f" />


## Usuários

<img width="365" height="767" alt="image" src="https://github.com/user-attachments/assets/f8bfd348-fa1c-4735-b055-9650ef2de1ba" />


## Criação de grupo

<img width="367" height="776" alt="image" src="https://github.com/user-attachments/assets/a422b9d3-cc85-474f-aed7-ae7cc139c7a9" />


## Gerenciamento do grupo

<img width="355" height="780" alt="image" src="https://github.com/user-attachments/assets/7e6c8c47-0fcb-41ce-a550-7697f9c9de74" />


## Chat individual

<img width="357" height="760" alt="image" src="https://github.com/user-attachments/assets/530e145c-485c-421d-b9ef-9d85984a2f63" />


## Chat em grupo

<img width="361" height="776" alt="image" src="https://github.com/user-attachments/assets/c10fcdca-fc99-4fed-891d-c6a5262d4e43" />


## Perfil

<img width="353" height="782" alt="image" src="https://github.com/user-attachments/assets/8f029f1a-8278-4f02-8748-db8fdf41f2b0" />


---

# Evidência de Push Notification

<img width="475" height="377" alt="image" src="https://github.com/user-attachments/assets/cfe2ca0c-eda9-41f5-bdc0-330281ec388e" />


A evidência deverá demonstrar uma notificação recebida a partir de uma mensagem enviada pelo aplicativo e processada pela API pública.

---

# Fluxo geral

```text
Firebase Authentication
        ↓
Usuário autenticado
        ↓
Firestore
(perfis / grupos / tokens)
        ↓
Realtime Database
(mensagens)
        ↓
API Node.js + Express
        ↓
Firebase Admin SDK
        ↓
Expo Push Service / FCM
        ↓
Notificação
```

