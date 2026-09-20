// Indicador de carregamento (spinner) exibido durante as trocas de conteúdo.

export function showLoader(show) {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.hidden = !show;
    }
}
