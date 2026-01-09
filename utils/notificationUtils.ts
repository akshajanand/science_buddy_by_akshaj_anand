
export type ToastType = 'success' | 'error' | 'info';

export interface ToastEventDetail {
    message: string;
    type: ToastType;
}

export const showToast = (message: string, type: ToastType = 'info') => {
    const event = new CustomEvent<ToastEventDetail>('science-buddy-toast', { 
        detail: { message, type } 
    });
    window.dispatchEvent(event);
};
