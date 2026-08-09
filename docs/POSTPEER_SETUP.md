# Configuração PostPeer — Flux Post

Este documento descreve como configurar a integração com o PostPeer para gerenciamento de contas sociais multicanal.

## 1. Segredos do Backend

A integração requer a configuração dos seguintes secrets no Lovable Cloud / Supabase:

*   `POSTPEER_API_KEY`: Sua chave de API oficial do PostPeer.
*   `APP_URL`: A URL base do seu aplicativo Flux Post (ex: `https://seu-app.lovable.app`).

## 2. Configuração no Painel PostPeer

1.  Acesse o painel do [PostPeer](https://postpeer.app).
2.  Crie um novo projeto ou use um existente.
3.  Configure a **Redirect URL** (Callback) no PostPeer:
    `https://[PROJECT_REF].supabase.co/functions/v1/postpeer-callback`
    *(Substitua `[PROJECT_REF]` pela referência do seu projeto backend)*.

## 3. Arquitetura SocialProvider

O Flux Post utiliza uma camada de abstração `SocialProvider` para gerenciar conexões. 

### Fluxo de Conexão
1.  **Frontend**: O usuário clica em "CONECTAR".
2.  **Edge Function (`postpeer-connect`)**:
    *   Valida a conta interna.
    *   Chama `POST /connections` no PostPeer.
    *   Retorna a `authorization_url`.
3.  **Autorização**: O usuário autoriza a rede social no ambiente PostPeer.
4.  **Callback (`postpeer-callback`)**:
    *   PostPeer redireciona de volta para o Flux Post.
    *   O Flux valida o `state` e o `connection_id`.
    *   Associa a conexão à `social_account` local.
    *   Atualiza o status para 🟢 **Conectada**.

## 4. Identificadores

*   `social_accounts.id`: Identidade interna permanente no Flux Post.
*   `provider_connection_id`: ID da conexão no PostPeer.
*   `external_account_id`: ID da conta na própria rede social (ex: TikTok Open ID).

## 5. Testes

Para testar a infraestrutura sem uma API Key real:
1.  O CRUD de contas funcionará normalmente.
2.  Ao tentar conectar, o sistema retornará o erro: **"Configuração PostPeer pendente."**

---
*Nota: A postagem de vídeos será implementada na Fase 3.3.*
