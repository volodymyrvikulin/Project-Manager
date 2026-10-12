import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { fetchUpdateProfile, selectIsAuth, selectAuthData } from '../../redux/slices/auth';
import styles from './Profile.module.css';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MyButton from '../../components/ui/button/MyButton';
import { FaArrowLeft, FaCamera } from 'react-icons/fa';

const BACKEND_URL = 'http://localhost:5000';

const Profile = () => {
    const isAuth = useSelector(selectIsAuth);
    const userData = useSelector(selectAuthData);
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [bio, setBio] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [avatarFile, setAvatarFile] = useState(null);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (userData) {
            setFullName(userData.fullName || '');
            setPhone(userData.phone || '');
            setBio(userData.bio || '');
            setAvatarUrl(userData.avatarUrl ? `${BACKEND_URL}${userData.avatarUrl}` : '');
        }
    }, [userData]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarFile(file);
            setAvatarUrl(URL.createObjectURL(file));
        }
    };

    const handleFullNameChange = (e) => {
        const newFullName = e.target.value;
        if (newFullName.length <= 50) {
            setFullName(newFullName);
        } else {
            setError('Ім’я не може перевищувати 50 символів');
        }
    };

    const handlePhoneChange = (e) => {
        const newPhone = e.target.value;
        if (newPhone.length <= 20) {
            setPhone(newPhone);
        } else {
            setError('Номер телефону не може перевищувати 20 символів');
        }
    };

    const handleBioChange = (e) => {
        const newBio = e.target.value;
        if (newBio.length <= 500) {
            setBio(newBio);
        } else {
            setError('Опис профілю не може перевищувати 500 символів');
        }
    };

    const handleSaveProfile = async () => {
        setError(null);
        const formData = new FormData();
        formData.append('fullName', fullName);
        formData.append('phone', phone);
        formData.append('bio', bio);
        if (avatarFile) {
            formData.append('avatar', avatarFile);
        }

        const result = await dispatch(fetchUpdateProfile(formData));
        if (fetchUpdateProfile.fulfilled.match(result)) {
            const updatedUser = result.payload;
            setFullName(updatedUser.fullName || '');
            setPhone(updatedUser.phone || '');
            setBio(updatedUser.bio || '');
            setAvatarUrl(updatedUser.avatarUrl ? `${BACKEND_URL}${updatedUser.avatarUrl}` : '');
            setAvatarFile(null);
        } else {
            setError(result.payload || 'Помилка при збереженні профілю');
        }
    };

    const handleChooseFile = () => {
        fileInputRef.current.click();
    };

    if (!isAuth) {
        return <Navigate to="/login" />;
    }

    return (
        <Paper classes={{ root: styles.root }}>
            <MyButton
                className={styles.backLink}
                onClick={() => navigate('/')}
            >
                <FaArrowLeft /> Назад
            </MyButton>
            <Typography classes={{ root: styles.title }} variant="h5">
                Профіль користувача
            </Typography>
            {error && (
                <Typography color="error" className={styles.error}>
                    {error}
                </Typography>
            )}
            <div className={styles.profileContent}>
                <div className={styles.avatarSection}>
                    {avatarUrl ? (
                        <img
                            src={avatarUrl}
                            alt="Фото профілю"
                            className={styles.avatar}
                            onError={() => setAvatarUrl('')}
                        />
                    ) : (
                        <div className={styles.avatarPlaceholder}>Немає фото</div>
                    )}
                    <button className={styles.changePhotoButton} onClick={handleChooseFile}>
                        <FaCamera />
                        <span className={styles.tooltip}>Змінити фото</span>
                    </button>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className={styles.fileInput}
                    />
                </div>
                <div className={styles.infoSection}>
                    <TextField
                        label="Ім'я"
                        value={fullName}
                        onChange={handleFullNameChange}
                        fullWidth
                        className={styles.field}
                    />
                    <TextField
                        label="Email"
                        value={userData?.email || ''}
                        disabled
                        fullWidth
                        className={styles.field}
                    />
                    <TextField
                        label="Телефон"
                        value={phone}
                        onChange={handlePhoneChange}
                        fullWidth
                        className={styles.field}
                    />
                    <TextField
                        label="Опис профілю"
                        value={bio}
                        onChange={handleBioChange}
                        fullWidth
                        multiline
                        rows={3}
                        className={styles.field}
                        helperText={`${bio.length}/500`}
                    />
                    <div className={styles.infoItem}>
                        <Typography variant="body1">
                            Дата реєстрації: {userData?.createdAt ? new Date(userData.createdAt).toLocaleDateString() : '—'}
                        </Typography>
                    </div>
                    <MyButton onClick={handleSaveProfile} className={styles.saveButton}>
                        Зберегти зміни
                    </MyButton>
                </div>
            </div>
        </Paper>
    );
};

export default Profile;