# Plano: Conectar o projeto ao GitHub e obter o link do repositório

## Contexto
O projeto atual ainda não está conectado ao GitHub, por isso ainda não existe um link de repositório para entregar. Este plano descreve os passos exatos que o usuário precisa executar na interface do Lovable para criar a conexão e conseguir o link.

Lovable não expõe o link do GitHub via chat/API — o link só aparece na própria interface depois que a conexão é feita. Por isso, este plano é uma sequência de ações do usuário, não mudanças de código.

## Passos para o usuário

### 1. Conectar o workspace ao GitHub
- No canto inferior esquerdo do chat, abrir o menu **+ (Plus)**.
- Clicar em **GitHub → Connect project**.
- Autorizar o Lovable GitHub App na conta GitHub escolhida.
- Selecionar a conta/organização onde o repositório será criado.

### 2. Criar o repositório
- Após autorizar, clicar em **Create Repository** dentro do Lovable.
- Aguardar a criação inicial (alguns segundos). A sincronização bidirecional começa automaticamente.

### 3. Obter o link do repositório
- Abrir o menu **+ (Plus)** novamente → **GitHub**.
- No menu suspenso aparecerá a opção **View on GitHub** com o link direto para o repositório.
- Os URLs de clone (HTTPS, SSH, GitHub CLI) também ficam disponíveis nessa mesma seção.

### 4. (Opcional) Sincronização contínua
- Qualquer mudança feita no Lovable a partir desse momento é enviada ao GitHub automaticamente.
- Mudanças feitas direto no GitHub e empurradas para `main` aparecem no Lovable sem precisar de pull manual.

## Verificação depois de conectar
- Confirmar que aparece o status **Connected** em Project Settings → Git → GitHub.
- Clicar em **View on GitHub** e validar que o repositório contém o código do projeto.

## Limitações a ter em conta
- Só é possível sincronizar **um branch por vez** (por padrão, `main`).
- Lovable **não importa** repositórios GitHub já existentes — só exporta para o GitHub.
- Apenas **uma conta GitHub** pode ser conectada por conta Lovable de cada vez.
- O recurso experimental de **branch switching** exige ativar em Account Settings → Labs.

## Próximo passo
Assim que o usuário terminar os passos acima e quiser que eu trabalhe diretamente com o repositório (por exemplo, abrir PRs, revisar diffs ou criar branches), posso continuar a partir daí.
