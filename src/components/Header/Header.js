import React, { useState } from 'react';
import styles from './Header.module.css';
import Container from '@mui/material/Container';
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import { logout, selectIsAuth, selectAuthData } from '../../redux/slices/auth';
import { FaEnvelope, FaSignOutAlt, FaSignInAlt, FaUserPlus, FaUser, FaBars } from 'react-icons/fa';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

const Header = ({ toggleSidebar, showMenuButton = true }) => {
    const isAuth = useSelector(selectIsAuth);
    const authData = useSelector(selectAuthData);
    const dispatch = useDispatch();
    const [logoutModalVisible, setLogoutModalVisible] = useState(false);

    const pendingCount = authData?.pendingInvitations?.filter(i => i.status === 'pending').length || 0;

    const onClickLogout = () => {
        setLogoutModalVisible(true);
    };

    const handleConfirmLogout = () => {
        dispatch(logout());
        window.localStorage.removeItem('token');
    };

    return (
        <div className={styles.root}>
            <Container maxWidth={false}>
                <div className={styles.inner}>
                    <Link className={styles.logo} to="/">
                        <div>Management-App</div>
                    </Link>
                    <div className={styles.buttons}>
                        {showMenuButton && (
                            <button onClick={toggleSidebar} className={styles.iconButton} aria-label="Відкрити бокову панель">
                                <FaBars />
                                <span className={styles.tooltip}>Відкрити меню</span>
                            </button>
                        )}
                        {isAuth ? (
                            <>
                                <Link to="/profile">
                                    <button className={styles.iconButton} aria-label="Профіль">
                                        <FaUser />
                                        <span className={styles.tooltip}>Профіль</span>
                                    </button>
                                </Link>
                                <Link to="/invitations">
                                    <button className={styles.iconButton} aria-label="Запрошення">
                                        <FaEnvelope />
                                        {pendingCount > 0 && (
                                            <span className={styles.badge}>{pendingCount}</span>
                                        )}
                                        <span className={styles.tooltip}>
                                            {pendingCount > 0 ? `Запрошення (${pendingCount})` : 'Запрошення'}
                                        </span>
                                    </button>
                                </Link>
                                <button onClick={onClickLogout} className={styles.iconButton} aria-label="Вийти">
                                    <FaSignOutAlt />
                                    <span className={styles.tooltip}>Вийти</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link to="/login">
                                    <button className={styles.iconButton} aria-label="Увійти">
                                        <FaSignInAlt />
                                        <span className={styles.tooltip}>Увійти</span>
                                    </button>
                                </Link>
                                <Link to="/register">
                                    <button className={styles.iconButton} aria-label="Створити акаунт">
                                        <FaUserPlus />
                                        <span className={styles.tooltip}>Зареєструватися</span>
                                    </button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </Container>
            <ConfirmModal
                visible={logoutModalVisible}
                setVisible={setLogoutModalVisible}
                title="Вихід із системи"
                message="Ви дійсно хочете вийти зі свого акаунту?"
                confirmText="Вийти"
                cancelText="Скасувати"
                danger={true}
                onConfirm={handleConfirmLogout}
            />
        </div>
    );
};

export default Header;