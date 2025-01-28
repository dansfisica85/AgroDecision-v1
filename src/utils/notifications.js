export const showError = (message) => {
    Swal.fire({
        title: 'Erro',
        text: message,
        icon: 'error',
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#4CAF50'
    });
};

export const showLoadingAnimation = () => {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'loading-overlay';
    loadingOverlay.id = 'loadingOverlay';
    // ... resto do código da animação
};

export const hideLoadingAnimation = () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('fade-out');
        setTimeout(() => loadingOverlay.remove(), 500);
    }
};