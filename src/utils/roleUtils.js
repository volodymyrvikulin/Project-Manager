export const ROLES = {
    OWNER: 'owner',
    ADMIN: 'admin',
    MEMBER: 'member',
    VIEWER: 'viewer',
};

export const ROLE_CONFIG = {
    owner: {
        id: 'owner',
        title: 'Власник',
        icon: '👑',
        color: '#b45309',
        bgColor: '#fef3c7',
        borderColor: '#fcd34d',
        description: 'Повний контроль над проєктом: керування ролями, редагування та видалення проєкту.',
    },
    admin: {
        id: 'admin',
        title: 'Менеджер',
        icon: '🛡️',
        color: '#1d4ed8',
        bgColor: '#dbeafe',
        borderColor: '#93c5fd',
        description: 'Повне керування всіма задачами: створення, редагування, видалення, ШІ-декомпозиція та запрошення нових учасників.',
    },
    member: {
        id: 'member',
        title: 'Виконавець',
        icon: '👤',
        color: '#047857',
        bgColor: '#d1fae5',
        borderColor: '#6ee7b7',
        description: 'Створення задач, виконання та зміна статусу, редагування призначених задач та декомпозиція.',
    },
    viewer: {
        id: 'viewer',
        title: 'Спостерігач',
        icon: '👁️',
        color: '#4b5563',
        bgColor: '#f3f4f6',
        borderColor: '#d1d5db',
        description: 'Лише перегляд: список задач, діаграма Ганта, мережевий графік задач, статистика та аналіз ризиків.',
    },
};

export const getMemberRole = (memberId, ownerId, permissions = []) => {
    if (!memberId) return 'viewer';
    const memberIdStr = memberId.toString();
    const ownerIdStr = ownerId?._id ? ownerId._id.toString() : ownerId?.toString();
    if (memberIdStr === ownerIdStr) return 'owner';

    const perm = permissions?.find(p => {
        const pUserId = p.userId?._id ? p.userId._id.toString() : p.userId?.toString();
        return pUserId === memberIdStr;
    });

    if (perm?.role) return perm.role;

    // Legacy fallback based on existing booleans
    if (perm?.canDeleteTasks && perm?.canEditTasks) return 'admin';
    if (perm?.canAddTasks || perm?.canEditTasks) return 'member';
    if (perm) return 'viewer';

    return 'member'; // Default for members in group
};

export const getRolePermissions = (role) => {
    switch (role) {
        case 'owner':
            return {
                canAddTasks: true,
                canEditTasks: true,
                canDeleteTasks: true,
                canChangeStatus: true,
                canInviteUsers: true,
                canManageRoles: true,
                canDeleteProject: true,
                canEditProject: true,
            };
        case 'admin':
            return {
                canAddTasks: true,
                canEditTasks: true,
                canDeleteTasks: true,
                canChangeStatus: true,
                canInviteUsers: true,
                canManageRoles: false,
                canDeleteProject: false,
                canEditProject: false,
            };
        case 'member':
            return {
                canAddTasks: true,
                canEditTasks: false, // only tasks assigned to member
                canDeleteTasks: false,
                canChangeStatus: true,
                canInviteUsers: false,
                canManageRoles: false,
                canDeleteProject: false,
                canEditProject: false,
            };
        case 'viewer':
        default:
            return {
                canAddTasks: false,
                canEditTasks: false,
                canDeleteTasks: false,
                canChangeStatus: false,
                canInviteUsers: false,
                canManageRoles: false,
                canDeleteProject: false,
                canEditProject: false,
            };
    }
};

