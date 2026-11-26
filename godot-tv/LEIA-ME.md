# Ecos de Sagres — app nativa para Google TV / Android TV

Versão do jogo feita em [Godot 4.3](https://godotengine.org) que corre diretamente na TV
(sem Chromecast nem browser). Os telemóveis continuam a ser os comandos: a TV mostra um
código QR, cada jogador lê-o com a câmara e o comando abre no browser do telemóvel.

## Instalar na TV (uma vez)

1. Na TV, abre a **Play Store** e instala a app **Downloader** (de AFTVnews).
2. Em **Definições → Sistema → Acerca de**, carrega 7 vezes em *Compilação do SO Android TV*
   para ativar as opções de programador (só é preciso em algumas TVs).
3. Em **Definições → Apps → Segurança e restrições → Fontes desconhecidas**, autoriza o **Downloader**.
4. Abre o Downloader e escreve o endereço:
   `cmmleite22-beep.github.io/ecos-de-sagres/apk`
5. Quando o download acabar, carrega em **Instalar**. A app aparece na lista de apps da TV
   como **Ecos de Sagres**.

Para atualizar, repete o passo 4. (Se a TV disser que a app não é compatível com a versão
instalada, desinstala a anterior primeiro.)

## Jogar

1. Abre **Ecos de Sagres** na TV.
2. Com o telemóvel **na mesma rede wifi**, lê o código QR que aparece na TV.
3. Escolhe a personagem e carrega em **COMEÇAR**. Podem entrar até 4 jogadores.

O botão **Voltar** do comando da TV fecha a app.

## Como funciona

- A app abre um pequeno servidor na TV (porta 8080) que serve o mesmo comando da versão web
  e fala o mesmo protocolo por WebSocket. Não há servidores na internet.
- O capítulo 1 é o mesmo da versão web (mesmas regras, física e níveis), com materiais
  fotográficos CC0 do [Poly Haven](https://polyhaven.com) quando a compilação os consegue
  descarregar, iluminação com sombras, nevoeiro, brilho e água com reflexos.
- O APK é compilado automaticamente pelo GitHub Actions
  (`.github/workflows/android-tv.yml`) e publicado na release `tv-main`.

## Desenvolver

```sh
python3 godot-tv/sync_web.py        # embute o comando do telemóvel no projeto
python3 godot-tv/fetch_assets.py    # (opcional) texturas fotográficas
godot --path godot-tv               # abre/corre no PC; tecla K = jogar com teclado e rato
```
