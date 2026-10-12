import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchUserById, selectUserProfile } from '../../redux/slices/auth';
import EditPermissionsForm from '../EditPermissionsForm/EditPermissionsForm';
import UserProfileModal from '../UserProfileModal/UserProfileModal';
import styles from './MembersList.module.css';
import { FaTrash, FaSignOutAlt } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { getMemberRole, ROLE_CONFIG } from '../../utils/roleUtils';

const MembersList = ({
    members,
    isOwner,
    ownerId,
    permissions = [],
    authData,
    handleRemoveUser,
    handleLeaveGroup,
    groupId,
    permissionsState,
    updatePermissionsState,
}) => {
    const dispatch = useDispatch();
    const userProfile = useSelector(selectUserProfile);
    const [modalVisible, setModalVisible] = useState(false);
    const { showToast } = useToast();

    if (!Array.isArray(members) || members.length === 0) {
        return null;
    }

    const handleViewProfile = (memberId) => {
        dispatch(fetchUserById(memberId))
            .then(() => {
                setModalVisible(true);
            })
            .catch((error) => {
                showToast(error.payload || 'Помилка при отриманні даних користувача', 'error');
            });
    };

    return (
        <div className={styles.membersList}>
            <div className={styles.headerRow}>
                <h3>Учасники проєкту ({members.length}):</h3>
            </div>
            <ul className={styles.membersUl}>
                {members.map((member) => {
                    if (!member || !member._id) return null;

                    const role = getMemberRole(member._id, ownerId, permissions);
                    const roleInfo = ROLE_CONFIG[role] || ROLE_CONFIG.member;
                    const isMemberOwner = role === 'owner';
                    const isCurrentAuthUser = authData?._id === member._id.toString();

                    return (
                        <li key={member._id} className={styles.memberItem}>
                            <div className={styles.memberInfo}>
                                <span
                                    className={styles.memberName}
                                    onClick={() => handleViewProfile(member._id)}
                                    title="Натисніть для перегляду профілю"
                                >
                                    {member.fullName}
                                </span>
                                <span className={styles.memberEmail}>({member.email})</span>
                                <span
                                    className={styles.roleBadge}
                                    style={{
                                        backgroundColor: roleInfo.bgColor,
                                        color: roleInfo.color,
                                        borderColor: roleInfo.borderColor,
                                    }}
                                    title={roleInfo.description}
                                >
                                    <span className={styles.roleIcon}>{roleInfo.icon}</span>
                                    <span>{roleInfo.title}</span>
                                </span>
                            </div>

                            <div className={styles.memberActions}>
                                {isCurrentAuthUser && !isOwner && (
                                    <button
                                        onClick={() => handleLeaveGroup(member._id)}
                                        className={styles.iconButton}
                                        aria-label="Вийти з проєкту"
                                    >
                                        <FaSignOutAlt />
                                        <span className={styles.tooltip}>Вийти з проєкту</span>
                                    </button>
                                )}
                                {isOwner && !isMemberOwner && (
                                    <>
                                        <EditPermissionsForm
                                            groupId={groupId}
                                            memberId={member._id}
                                            memberName={member.fullName}
                                            initialPermissions={permissionsState[member._id] || { role }}
                                            updatePermissionsState={updatePermissionsState}
                                        />
                                        <button
                                            onClick={() => handleRemoveUser(member._id)}
                                            className={`${styles.iconButton} ${styles.dangerButton}`}
                                            aria-label="Видалити учасника"
                                        >
                                            <FaTrash />
                                            <span className={styles.tooltip}>Видалити з проєкту</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <UserProfileModal
                visible={modalVisible}
                setVisible={setModalVisible}
                user={userProfile}
            />
        </div>
    );
};

export default MembersList;