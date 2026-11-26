# Backend do Aldebaran

API NestJS com PostgreSQL, Prisma e Socket.IO. O [README principal](../README.md) descreve a instalação, os testes e o deploy no Render.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão do Prisma com o PostgreSQL |
| `JWT_SECRET` | Chave privada para assinar e validar as sessões |
| `JWT_EXPIRY` | Duração da sessão em segundos. O padrão é 86400 |
| `NODE_ENV` | Modo de execução. Use `development` no desenvolvimento local |
| `PORT` | Porta HTTP. O padrão é 3000 |
| `CORS_ORIGINS` | Lista de origens adicionais separadas por vírgula |
| `REDIS_URL` | Conexão opcional para distribuir eventos Socket.IO |
| `SHADOW_DATABASE_URL` | Banco auxiliar opcional para gerar migrações durante o desenvolvimento |

Use um `.env` local e as variáveis do serviço para o deploy. Bancos de teste devem ter credenciais próprias.

## Primeiro acesso em uma base vazia

Depois de aplicar as migrações, configure `ADMIN_PASSWORD` fora do Git com pelo menos 12 caracteres e até 72 bytes em UTF-8. `ADMIN_LOGIN` é opcional e o padrão é `admin`. `ADMIN_EMAIL` também é opcional.

Execute o comando na pasta `backend`.

```sh
npm run seed
```

O seed cria a conta inicial e preserva as credenciais de um administrador já cadastrado. Para testar os fluxos operacionais, faça login e cadastre uma filial, um serviço e um guichê. Configure o totem e o painel para a mesma filial.

## Onde alterar

- [Fila](src/fila) e [motor de prioridade](src/domain/engine) para emissão, chamada e transições de atendimento.
- [Agendamento](src/agendamento) para horários, regras da filial, comprovantes e check-in.
- [Autenticação](src/auth) e [usuários](src/usuario) para JWT, perfis e redefinição de senhas.
- [Notificações](src/notificacao) para consultas e eventos em tempo real.
- [Prisma](prisma) para alterações de schema e migrações. Gere uma migração nova a partir de um banco de desenvolvimento e mantenha as anteriores intactas.
