# Open Video Studio Editor

Microfrontend de edição visual do Open Video Studio.

## Desenvolvimento

```bash
pnpm --filter editor dev
```

O app roda em `http://localhost:3002/editor` e é exposto pelo app web em
`http://localhost:3000/editor` via rewrite.

## Integração

Projetos existentes abrem em:

```txt
/editor/edit/:projectId
```

O editor carrega dados da API principal usando `NEXT_PUBLIC_API_URL` ou
`http://localhost:4000`.
