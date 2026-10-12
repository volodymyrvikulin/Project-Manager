import React from 'react';
import styles from './MyModal.module.css';

const MyModal = ({ visible, setVisible, children, className, contentClassName }) => {
    const { myModal, active, myModalContent } = styles;
    const modalClasses = [myModal, visible && active, className].filter(Boolean).join(' ');
    const contentClasses = [myModalContent, contentClassName].filter(Boolean).join(' ');
    const closeModal = () => {
        setVisible(false);
    };
    return (
        <div onClick={closeModal} className={modalClasses}>
            <div onClick={(e) => e.stopPropagation()} className={contentClasses}>
                {children}
            </div>
        </div>
    );
};

export default MyModal;