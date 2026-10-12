import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import MyButton from '../ui/button/MyButton';
import MyModal from '../ui/modal/MyModal';
import styles from './EditPermissionsForm.module.css';
import { fetchUpdatePermissions, fetchGroups } from '../../redux/slices/groups';
import { FaUserShield, FaCheck } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { ROLE_CONFIG } from '../../utils/roleUtils';

const EditPermissionsForm = ({ groupId, memberId, memberName, initialPermissions = {}, updatePermissionsState }) => {
    const dispatch = useDispatch();
    const { showToast } = useToast();
    const [permissionsModalVisible, setPermissionsModalVisible] = useState(false);

    const initialRole = initialPermissions?.role || (
        initialPermissions?.canDeleteTasks && initialPermissions?.canEditTasks ? 'admin' :
        initialPermissions?.canAddTasks ? 'member' : 'viewer'
    );

    const [selectedRole, setSelectedRole] = useState(initialRole);

    useEffect(() => {
        if (initialPermissions?.role) {
            setSelectedRole(initialPermissions.role);
        }
    }, [initialPermissions]);

    const rolesList = [
        ROLE_CONFIG.admin,
        ROLE_CONFIG.member,
        ROLE_CONFIG.viewer,
    ];

    const savePermissions = () => {
        dispatch(fetchUpdatePermissions({
            groupId,
            userId: memberId,
            role: selectedRole,
        }))
            .then(() => {
                showToast(`Роль учасника змінено на "${ROLE_CONFIG[selectedRole].title}"`, 'success');
                dispatch(fetchGroups());
                if (updatePermissionsState) {
                    updatePermissionsState(memberId, {
                        ...initialPermissions,
                        role: selectedRole,
                    });
                }
                setPermissionsModalVisible(false);
            })
            .catch((error) => {
                showToast(error.response?.data?.message || 'Помилка при оновленні ролі', 'error');
            });
    };

    return (
        <>
            <button
                onClick={() => setPermissionsModalVisible(true)}
                className={styles.editPermissionsButton}
                aria-label="Керування роллю"
            >
                <FaUserShield />
                <span className={styles.tooltip}>Керування роллю</span>
            </button>
            <MyModal visible={permissionsModalVisible} setVisible={setPermissionsModalVisible}>
                <div className={styles.permissionsForm}>
                    <h3 className={styles.formTitle}>
                        Керування роллю {memberName ? `(${memberName})` : ''}
                    </h3>
                    <p className={styles.formSubtitle}>
                        Оберіть рівень доступу для учасника в проєкті:
                    </p>

                    <div className={styles.roleCardsContainer}>
                        {rolesList.map((role) => {
                            const isSelected = selectedRole === role.id;
                            return (
                                <div
                                    key={role.id}
                                    className={`${styles.roleCard} ${isSelected ? styles.roleCardActive : ''}`}
                                    onClick={() => setSelectedRole(role.id)}
                                >
                                    <div className={styles.roleCardHeader}>
                                        <span className={styles.roleCardIcon}>{role.icon}</span>
                                        <span className={styles.roleCardTitle} style={{ color: role.color }}>
                                            {role.title}
                                        </span>
                                        {isSelected && (
                                            <span className={styles.selectedBadge}>
                                                <FaCheck />
                                            </span>
                                        )}
                                    </div>
                                    <p className={styles.roleCardDescription}>{role.description}</p>
                                </div>
                            );
                        })}
                    </div>

                    <div className={styles.formActions}>
                        <MyButton
                            type="button"
                            onClick={() => setPermissionsModalVisible(false)}
                            className={styles.cancelBtn}
                        >
                            Скасувати
                        </MyButton>
                        <MyButton onClick={savePermissions} className={styles.saveBtn}>
                            Зберегти роль
                        </MyButton>
                    </div>
                </div>
            </MyModal>
        </>
    );
};

export default EditPermissionsForm;