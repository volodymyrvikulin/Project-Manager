import React, { createContext, useContext, useState, useCallback } from 'react';
import styles from './Toast.module.css';
import { FaCheckCircle, FaExclamationCircle, FaInfoCircle, FaTimes, FaEnvelope } from 'react-icons/fa';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', action = null) => {
        const id = Date.now() + Math.random().toString(36).substring(2, 9);
        const newToast = { id, message, type, action };

        setToasts((prev) => [...prev, newToast]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4500);

        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, removeToast }}>
            {children}
            <div className={styles.toastContainer}>
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`${styles.toast} ${styles[toast.type] || styles.info}`}
                        onClick={() => {
                            if (toast.action?.onClick) {
                                toast.action.onClick();
                                removeToast(toast.id);
                            }
                        }}
                    >
                        <div className={styles.toastIcon}>
                            {toast.type === 'success' && <FaCheckCircle />}
                            {toast.type === 'error' && <FaExclamationCircle />}
                            {toast.type === 'invite' && <FaEnvelope />}
                            {(toast.type === 'info' || !['success', 'error', 'invite'].includes(toast.type)) && <FaInfoCircle />}
                        </div>
                        <div className={styles.toastBody}>
                            <span className={styles.toastMessage}>{toast.message}</span>
                            {toast.action?.label && (
                                <span className={styles.toastActionLabel}>{toast.action.label}</span>
                            )}
                        </div>
                        <button
                            type="button"
                            className={styles.toastCloseBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                removeToast(toast.id);
                            }}
                            aria-label="Закрити"
                        >
                            <FaTimes />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export default ToastContext;

