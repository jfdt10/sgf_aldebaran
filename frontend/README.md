# Frontend do Aldebaran

Aplicação Angular 21 em TypeScript e SCSS. Consulte o [README principal](../README.md) para instalar as dependências, apontar para a API local e configurar o Cloudflare Pages.

## Onde alterar

| Caminho | Responsabilidade |
| --- | --- |
| [src/app/app.routes.ts](src/app/app.routes.ts) | Rotas e organização das áreas do aplicativo |
| [src/app/pages](src/app/pages) | Telas de administração, supervisão, operação, cliente, totem e TV |
| [src/app/services](src/app/services) | Integração HTTP, autenticação e notificações |
| [src/app/interceptors](src/app/interceptors) | Envio da autorização nas chamadas à API |
| [src/environments](src/environments) | URL da API e modo de execução |

Da pasta `frontend`, use `npm start` para desenvolvimento, `npm test -- --watch=false` para testes unitários e `npm run build -- --configuration production` para gerar `dist/frontend/browser`.

As rotas do Angular organizam a navegação por perfil. Alterações de autorização precisam ser validadas também no backend, onde os endpoints aplicam as permissões.
