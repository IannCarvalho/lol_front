// Troca da imagem de fundo com crossfade suave e tratamento de falha.

// Duração do fade-out (deve casar com a transição em base.css).
const FADE_MS = 400;

// "Última chamada vence": duas trocas rápidas com a primeira imagem lenta
// fariam a antiga ser aplicada por último. Cada chamada incrementa este token;
// após os awaits, só a chamada mais recente mexe no elemento de imagem.
let latestCall = 0;

// Define a imagem de fundo. Retorna uma Promise que resolve quando a troca
// (com fade) termina. Se a URL falhar/for vazia, marca "failed" para o CSS
// mostrar o gradiente de fallback. Se outra troca começou enquanto esta
// esperava a imagem carregar, esta sai sem tocar o DOM (a mais recente vence).
export function setBackgroundImage(url) {
    const image = document.getElementById("image");
    const callId = ++latestCall;

    if (!url) {
        if (callId === latestCall) image.classList.add("image--failed");
        return Promise.resolve();
    }

    // inicia o fade-out imediatamente
    image.classList.add("image--fading");

    // pré-carrega a nova imagem em paralelo ao fade-out
    const preload = new Image();
    const loaded = new Promise((resolve) => {
        preload.onload = () => resolve(true);
        preload.onerror = () => resolve(false);
    });
    preload.src = url;

    // garante um tempo mínimo de fade-out (mesmo com imagem em cache), para o
    // crossfade ser sempre visível
    const faded = new Promise((resolve) => setTimeout(resolve, FADE_MS));

    return Promise.all([loaded, faded]).then(([ok]) => {
        // outra troca começou depois desta: a mais recente é quem decide.
        if (callId !== latestCall) return;
        if (ok) {
            image.src = url;
            image.classList.remove("image--failed");
            requestAnimationFrame(() => image.classList.remove("image--fading"));
        } else {
            image.classList.add("image--failed");
            image.classList.remove("image--fading");
        }
    });
}
