# Aldebaran

Sistema de gestão de filas e atendimentos presenciais para operações com várias filiais. O cliente pode agendar e acompanhar o atendimento. A filial organiza a chegada pelo totem, a chamada no painel e o atendimento por guichê.

[Abrir o Aldebaran](https://aldebaran-frontend.pages.dev/) · [Verificar a API](https://aldebaran-backend-jusq.onrender.com/health)

## Fluxos do sistema

| Área | O que faz |
| --- | --- |
| Cliente | Agendamento, consulta de comprovantes, acompanhamento e configuração do perfil |
| Totem e painel | Emissão de senhas, check-in e exibição das chamadas |
| Operação | Seleção de guichê, chamada, transferência e conclusão do atendimento |
| Supervisão | Acompanhamento da fila, relatórios e configurações da filial |
| Administração | Gestão de filiais, serviços, regras, usuários e cadastros, além de tarefas e auditoria |

## Estrutura do repositório

O projeto usa TypeScript em um monorepo com dois pacotes npm independentes. O **Angular 21** consome a API HTTP do **NestJS 11** e recebe eventos em tempo real por **Socket.IO**. O **PostgreSQL** guarda os dados e o **Prisma 7** gerencia o schema e as migrações. O Redis é opcional para distribuir eventos de WebSocket entre instâncias do backend.

| Caminho | Onde trabalhar |
| --- | --- |
| [backend/src](backend/src) | Regras de negócio, controllers, autenticação e integrações |
| [backend/prisma](backend/prisma) | Schema, migrações e criação inicial do administrador |
| [backend/test](backend/test) | Testes HTTP do backend |
| [frontend/src/app](frontend/src/app) | Rotas, telas e serviços Angular |
| [frontend/src/environments](frontend/src/environments) | URL da API e configuração de build |

## Executar localmente

Use **Node.js 24**, npm e **PostgreSQL 18**, versões com as quais o projeto foi validado. Crie um banco local vazio com um usuário autorizado a criar tabelas e habilitar as extensões do projeto (`uuid-ossp` e `unaccent`).

### Backend

Crie `backend/.env` com os valores do ambiente local. Substitua os exemplos pela senha do seu banco e por uma chave JWT aleatória.

```dotenv
DATABASE_URL=postgresql://aldebaran:SENHA_LOCAL@127.0.0.1:5432/aldebaran
JWT_SECRET=SUBSTITUA_POR_UMA_CHAVE_ALEATORIA
NODE_ENV=development
PORT=3000
```

Rode os comandos abaixo a partir da raiz do repositório.

```sh
cd backend
npm ci
npm run generate
npx prisma migrate deploy
npm run start:dev
```

Abra `http://localhost:3000/health`. A API retorna `200` quando consegue consultar o banco e `503` quando a consulta falha. Consulte o [guia do backend](backend/README.md) para criar o primeiro administrador e preparar uma filial de teste.

### Frontend

Para desenvolvimento local, aponte `apiUrl` em [environment.defaults.ts](frontend/src/environments/environment.defaults.ts) para `http://localhost:3000`. Mantenha esse ajuste somente na sua cópia local, pois a configuração do build de produção também usa esse arquivo.

Abra outro terminal na raiz do reposit?rio e rode os comandos abaixo.

```sh
cd frontend
npm ci
npm start
```

Abra `http://localhost:4200`. Consulte o [guia do frontend](frontend/README.md) para localizar as rotas e conferir a saída do build.

## Testes e build

Execute os comandos a partir da pasta indicada. No backend, gere o Prisma Client antes dos testes. Em PowerShell, use `npm.cmd` e `npx.cmd` se a política local bloquear os scripts do npm.

| Pasta | O que verificar | Comando |
| --- | --- | --- |
| `backend` | Testes unitários | `npm test -- --runInBand` |
| `backend` | Testes HTTP | `npm run test:e2e -- --runInBand` |
| `backend` | Build | `npm run build` |
| `frontend` | Testes unitários | `npm test -- --watch=false` |
| `frontend` | Build de produção | `npm run build -- --configuration production` |
| Ambas | Dependências de produção | `npm audit --omit=dev` |

Para validar uma alteração em fila ou agendamento, use um banco de teste. Confira a sequência completa, da emissão de senha ou criação do agendamento até o check-in, a chamada e a conclusão. Use também contas com perfis diferentes ao alterar permissões.

## Deploy

O repositório ligado aos serviços é [jfdt10/sgf_aldebaran](https://github.com/jfdt10/sgf_aldebaran). A preparação das alterações passa pela `hmlg`. Valide o build e os testes antes de enviar mudanças a essa branch, porque ela aciona o deploy do backend. Promova a versão validada para a `main` com um merge que preserve o histórico.

| Serviço | Branch | Diretório raiz | Build | Inicialização ou saída |
| --- | --- | --- | --- | --- |
| Render — backend | `hmlg` | `backend` | `npm install && npx prisma generate && npm run build` | `npm run start:prod` |
| Cloudflare Pages — frontend | `main` | `frontend` | `npm run build -- --configuration production` | `dist/frontend/browser` |

Configure `DATABASE_URL` e `JWT_SECRET` nas variáveis do serviço no Render. Use a URL interna do PostgreSQL quando ele estiver no mesmo workspace e na mesma região do backend. Para adicionar outro domínio ao frontend, configure-o também em `CORS_ORIGINS`.

O comando de build gera o Prisma Client. Quando houver migrações novas, teste-as em uma base descartável, revise o SQL e confirme o backup e o destino antes de executar `npx prisma migrate deploy` no banco do ambiente. Em um banco com dados e sem histórico do Prisma, verifique o estado do schema antes de aplicar a primeira migração.

Depois do deploy, abra o frontend, verifique `GET /health` e faça um teste de login com uma conta autorizada. Confira também `GET /filiais/public/count` e `GET /servicos/public/list`.

## Contas e dados

Em produção, a recuperação de acesso é assistida. A tela **Esqueci minha senha** registra uma solicitação privada para o administrador, que pode redefinir a senha após confirmar a identidade da pessoa. Compartilhe a senha temporária por um canal privado e peça a troca no primeiro acesso.

Mantenha arquivos de ambiente, credenciais e backups com dados fora do Git. Para manutenção, use dados sintéticos e preserve as migrações já aplicadas.
