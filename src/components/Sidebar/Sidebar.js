import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';
import MyButton from '../ui/button/MyButton';

const BACKEND_URL = 'http://localhost:5000';

const Sidebar = ({ isOpen, toggleSidebar, authData, setModalGroupVisible }) => {
    const navigate = useNavigate();
    const pendingCount = authData?.pendingInvitations?.filter(i => i.status === 'pending').length || 0;
    return (
        <div className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}>
            <div className={styles.avatarSection}>
                <Link to="/profile">
                    {authData?.avatarUrl ? (
                        <img
                            src={`${BACKEND_URL}${authData.avatarUrl}`}
                            alt="Аватар користувача"
                            className={styles.avatar}
                        />
                    ) : (
                        <div className={styles.avatarPlaceholder}>Немає фото</div>
                    )}
                </Link>
            </div>
            <div className={styles.buttonContainer}>
                <MyButton onClick={() => { toggleSidebar(); navigate('/'); }}>Головна</MyButton>
                <MyButton onClick={() => { toggleSidebar(); navigate('/profile'); }}>Профіль</MyButton>
                <MyButton onClick={() => { toggleSidebar(); navigate('/invitations'); }}>
                    Запрошення {pendingCount > 0 ? `(${pendingCount})` : ''}
                </MyButton>
                <MyButton onClick={() => { toggleSidebar(); navigate('/statistics'); }}>Загальна статистика</MyButton>
                <MyButton onClick={() => { toggleSidebar(); navigate('/network'); }}>Мережевий графік</MyButton>
                <MyButton onClick={() => { toggleSidebar(); navigate('/gantt'); }}>Діаграма Ганта</MyButton>
                <MyButton onClick={() => { toggleSidebar(); if (setModalGroupVisible) setModalGroupVisible(true); navigate('/'); }}>
                    Створити проєкт
                </MyButton>
            </div>
        </div>
    );
};

export default Sidebar;