import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <p>&copy; 2026 Management App. All rights reserved.</p>
            </div>
        </footer>
    );
};

export default Footer;