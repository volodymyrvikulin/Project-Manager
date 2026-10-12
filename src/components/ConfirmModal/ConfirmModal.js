import React from 'react';
import MyModal from '../ui/modal/MyModal';
import MyButton from '../ui/button/MyButton';
import styles from './ConfirmModal.module.css';

const ConfirmModal = ({
    visible,
    setVisible,
    title = 'Підтвердження',
    message = 'Ви впевнені?',
    onConfirm,
    confirmText = 'Підтвердити',
    cancelText = 'Скасувати',
    danger = false,
}) => {
    const handleConfirm = () => {
        setVisible(false);
        if (onConfirm) {
            onConfirm();
        }
    };

    return (
        <MyModal visible={visible} setVisible={setVisible}>
            <div className={styles.confirmWrapper}>
                <h3 className={styles.confirmTitle}>{title}</h3>
                <p className={styles.confirmMessage}>{message}</p>
                <div className={styles.confirmButtons}>
                    <MyButton
                        type="button"
                        onClick={() => setVisible(false)}
                        className={styles.cancelButton}
                    >
                        {cancelText}
                    </MyButton>
                    <MyButton
                        type="button"
                        onClick={handleConfirm}
                        className={danger ? styles.dangerButton : styles.primaryButton}
                    >
                        {confirmText}
                    </MyButton>
                </div>
            </div>
        </MyModal>
    );
};

export default ConfirmModal;

