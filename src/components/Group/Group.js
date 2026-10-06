import React, { useState } from 'react';
import AddTaskForm from '../AddTaskForm/AddTaskForm.js';
import GenerateTasksForm from '../GenerateTasksForm/GenerateTasksForm.js';
import { useNavigate, Navigate } from "react-router-dom";
import Task from '../Task/Task';
import MyModal from '../ui/modal/MyModal';
import styles from './Group.module.css';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDeleteTask, fetchUpdateGroup, fetchUpdateTask, fetchRemoveUser, fetchGroups, fetchInviteUser } from '../../redux/slices/groups';
import { selectIsAuth, selectAuthData } from '../../redux/slices/auth';
import InviteUserForm from '../InviteUserForm/InviteUserForm';
import EditGroupForm from '../EditGroupForm/EditGroupForm';
import MembersList from '../MembersList/MembersList';
import { FaPlus, FaMagic, FaTrash, FaChartBar, FaPencilAlt, FaUserPlus } from 'react-icons/fa';

const Group = ({
    group,
    removeGroup,
}) => {
    const { _id: groupId, title: groupTitle, tasks, members = [], user: ownerId, permissions = [] } = group;
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const isAuth = useSelector(selectIsAuth);
    const authData = useSelector(selectAuthData);
    const isOwner = authData && ownerId && authData._id === ownerId.toString();

    const userPermissions = permissions.find(perm => perm.userId === authData?._id) || {};
    const canAddTasks = isOwner || userPermissions.canAddTasks;
    const canEditTasks = isOwner || userPermissions.canEditTasks;
    const canDeleteTasks = isOwner || userPermissions.canDeleteTasks;

    const [edit, setEdit] = useState(null);
    const [value, setValue] = useState('');
    const [duration, setDuration] = useState(1);
    const [optimisticDuration, setOptimisticDuration] = useState(1);
    const [mostLikelyDuration, setMostLikelyDuration] = useState(1);
    const [pessimisticDuration, setPessimisticDuration] = useState(1);
    const [estimateRisk, setEstimateRisk] = useState(false);
    const [deadline, setDeadline] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [assignedTo, setAssignedTo] = useState('');
    const [modalTaskVisible, setModalTaskVisible] = useState(false);
    const [modalGenerateTasksVisible, setModalGenerateTasksVisible] = useState(false);
    const [modalGroupEditVisible, setModalGroupEditVisible] = useState(false);
    const [modalInviteVisible, setModalInviteVisible] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [editTitle, setEditTitle] = useState(groupTitle);
    const [permissionsState, setPermissionsState] = useState(
        members.reduce((acc, member) => ({
            ...acc,
            [member._id]: {
                canAddTasks: permissions.find(p => p.userId === member._id)?.canAddTasks || false,
                canEditTasks: permissions.find(p => p.userId === member._id)?.canEditTasks || false,
                canDeleteTasks: permissions.find(p => p.userId === member._id)?.canDeleteTasks || false,
            },
        }), {})
    );

    const checkCompleted = (group) => {
        let completed = 0;
        let notCompleted = 0;
        const taskDurations = [];
        const missedDeadlines = [];
        const dependencyStats = { withDependencies: 0, withoutDependencies: 0 };

        tasks.forEach((task) => {
            task.status ? ++notCompleted : ++completed;

            const duration = task.duration || 1;
            const existingDuration = taskDurations.find(d => d.duration === duration);
            if (existingDuration) {
                existingDuration.count += 1;
            } else {
                taskDurations.push({ duration, count: 1 });
            }

            if (task.deadline) {
                const deadlineDate = new Date(task.deadline);
                const today = new Date();
                if (deadlineDate < today && task.status) {
                    const groupMissed = missedDeadlines.find(md => md.group === groupTitle);
                    if (groupMissed) {
                        groupMissed.count += 1;
                    } else {
                        missedDeadlines.push({ group: groupTitle, count: 1 });
                    }
                }
            }

            if (task.dependencies && task.dependencies.length > 0) {
                dependencyStats.withDependencies += 1;
            } else {
                dependencyStats.withoutDependencies += 1;
            }
        });

        taskDurations.sort((a, b) => a.duration - b.duration);

        const updatedGroup = {
            ...group,
            completed,
            notCompleted,
            taskDurations,
            missedDeadlines,
            dependencyStats,
            type: 'group',
        };
        navigate('/statistics', { state: { statistics: updatedGroup } });
    };

    const removeTask = (task) => {
        const taskId = task._id;
        dispatch(fetchDeleteTask({ groupId, taskId }));
    };

    const statusTask = (task) => {
        const updatedTask = {
            ...task,
            status: !task.status
        };
        const taskId = task._id;
        dispatch(fetchUpdateTask({ updatedTask, groupId, taskId }));
    };

    const editTask = (task) => {
        setEdit(task._id);
        setValue(task.title);
        setDuration(task.duration || 1);
        setEstimateRisk(Boolean(task.pert && Number(task.pert.standardDeviation) > 0));
        setOptimisticDuration(task.pert?.optimistic || task.duration || 1);
        setMostLikelyDuration(task.pert?.mostLikely || task.duration || 1);
        setPessimisticDuration(task.pert?.pessimistic || task.duration || 1);
        setDeadline(task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : '');
        setDependencies(task.dependencies || []);
        setAssignedTo(task.assignedTo || '');
    };

    const saveTask = (task) => {
        const updatedTask = {
            ...task,
            title: value,
            duration: Number(duration),
            ...(estimateRisk && (() => {
                const optimistic = Math.max(1, Number(optimisticDuration) || Number(duration) || 1);
                const mostLikely = Math.max(optimistic, Number(mostLikelyDuration) || optimistic);
                const pessimistic = Math.max(mostLikely, Number(pessimisticDuration) || mostLikely);
                const expected = (optimistic + (4 * mostLikely) + pessimistic) / 6;
                const standardDeviation = (pessimistic - optimistic) / 6;
                return {
                    pert: {
                        optimistic,
                        mostLikely,
                        pessimistic,
                        expected,
                        standardDeviation,
                        variance: standardDeviation ** 2,
                    },
                };
            })()),
            deadline: deadline ? new Date(deadline).toISOString() : undefined,
            dependencies: dependencies || [],
            assignedTo: assignedTo || null,
        };
        const taskId = task._id;
        setEdit(null);
        setValue('');
        setDuration(1);
        setOptimisticDuration(1);
        setMostLikelyDuration(1);
        setPessimisticDuration(1);
        setEstimateRisk(false);
        setDeadline('');
        setDependencies([]);
        setAssignedTo('');
        dispatch(fetchUpdateTask({ updatedTask, groupId, taskId }));
    };

    const priorityTask = (task) => {
        const updatedTask = {
            ...task,
            priority: !task.priority
        };
        const taskId = task._id;
        dispatch(fetchUpdateTask({ updatedTask, groupId, taskId }));
    };

    const saveGroup = () => {
        const updatedGroup = {
            ...group,
            title: editTitle,
        };
        dispatch(fetchUpdateGroup({ updatedGroup, groupId }));
    };

    const handleInviteUser = (e) => {
        e.preventDefault();
        if (!inviteEmail) {
            alert('Введіть електронну адресу');
            return;
        }
        dispatch(fetchInviteUser({ groupId, email: inviteEmail }))
            .then(({ payload }) => {
                alert(payload.message);
                setInviteEmail('');
                setModalInviteVisible(false);
                dispatch(fetchGroups());
            })
            .catch((error) => {
                alert(error.response?.data?.message || 'Помилка при надсиланні запрошення');
            });
    };

    const handleRemoveUser = (userId) => {
        if (window.confirm('Ви впевнені, що хочете видалити цього користувача з проєкту?')) {
            dispatch(fetchRemoveUser({ groupId, userId }))
                .then(({ payload }) => {
                    alert(payload.message);
                    dispatch(fetchGroups());
                    setPermissionsState(prev => {
                        const newState = { ...prev };
                        delete newState[userId];
                        return newState;
                    });
                })
                .catch((error) => {
                    alert(error.response?.data?.message || 'Помилка при видаленні користувача');
                });
        }
    };

    const handleLeaveGroup = (userId) => {
        if (window.confirm('Ви впевнені, що хочете вийти з цього проєкту?')) {
            dispatch(fetchRemoveUser({ groupId, userId }))
                .then(({ payload }) => {
                    alert(payload.message);
                    dispatch(fetchGroups());
                    setPermissionsState(prev => {
                        const newState = { ...prev };
                        delete newState[userId];
                        return newState;
                    });
                })
                .catch((error) => {
                    alert(error.response?.data?.message || 'Помилка при виході з проєкту');
                });
        }
    };

    const updatePermissionsState = (memberId, updatedPermissions) => {
        setPermissionsState(prev => ({
            ...prev,
            [memberId]: updatedPermissions,
        }));
    };

    const taskOptions = tasks
        .filter(t => t._id !== (edit || ''))
        .map(task => ({
            value: task._id,
            name: task.title,
        }));

    if (!isAuth) {
        return <Navigate to="/login" />;
    }

    return (
        <div className={styles.groupContainer}>
            <h1 className={styles.groupHeader}>{groupTitle}</h1>
            <div className={styles.groupHeaderWrapper}>
                <div className={styles.actions}>
                    {canAddTasks && (
                        <>
                            <button onClick={() => setModalTaskVisible(true)} className={styles.iconButton} aria-label="Створити задачу">
                                <FaPlus />
                                <span className={styles.tooltip}>Створити задачу</span>
                            </button>
                            <button onClick={() => setModalGenerateTasksVisible(true)} className={styles.iconButton} aria-label="Згенерувати задачі">
                                <FaMagic />
                                <span className={styles.tooltip}>Згенерувати задачі</span>
                            </button>
                        </>
                    )}
                    {isOwner && (
                        <>
                            <button onClick={() => removeGroup(group)} className={styles.iconButton} aria-label="Видалити проєкт">
                                <FaTrash />
                                <span className={styles.tooltip}>Видалити проєкт</span>
                            </button>
                            <button onClick={() => setModalInviteVisible(true)} className={styles.iconButton} aria-label="Запросити користувача">
                                <FaUserPlus />
                                <span className={styles.tooltip}>Запросити користувача</span>
                            </button>
                            <button onClick={() => setModalGroupEditVisible(true)} className={styles.iconButton} aria-label="Редагувати проєкт">
                                <FaPencilAlt />
                                <span className={styles.tooltip}>Редагувати проєкт</span>
                            </button>
                        </>
                    )}
                    <button onClick={() => checkCompleted(group)} className={styles.iconButton} aria-label="Статистика проєкту">
                        <FaChartBar />
                        <span className={styles.tooltip}>Статистика проєкту</span>
                    </button>
                </div>
            </div>
            <MyModal visible={modalTaskVisible} setVisible={setModalTaskVisible}>
                <AddTaskForm id={group._id} setVisible={setModalTaskVisible} />
            </MyModal>
            <MyModal visible={modalGenerateTasksVisible} setVisible={setModalGenerateTasksVisible}>
                <GenerateTasksForm id={group._id} setVisible={setModalGenerateTasksVisible} />
            </MyModal>
            <MyModal visible={modalInviteVisible} setVisible={setModalInviteVisible}>
                <InviteUserForm
                    visible={modalInviteVisible}
                    setVisible={setModalInviteVisible}
                    inviteEmail={inviteEmail}
                    setInviteEmail={setInviteEmail}
                    handleInviteUser={handleInviteUser}
                />
            </MyModal>
            <EditGroupForm
                visible={modalGroupEditVisible}
                setVisible={setModalGroupEditVisible}
                group={group}
                saveGroup={saveGroup}
                editTitle={editTitle}
                setEditTitle={setEditTitle}
            />
            <MembersList
                members={members}
                isOwner={isOwner}
                authData={authData}
                handleRemoveUser={handleRemoveUser}
                handleLeaveGroup={handleLeaveGroup}
                groupId={groupId}
                permissionsState={permissionsState}
                updatePermissionsState={updatePermissionsState}
            />
            {tasks.length ? (
                <div className={styles.taskList}>
                    {tasks.map((task, index) => (
                        <Task
                            removeTask={removeTask}
                            statusTask={statusTask}
                            priorityTask={priorityTask}
                            edit={edit}
                            setEdit={setEdit}
                            editTask={editTask}
                            value={value}
                            setValue={setValue}
                            duration={duration}
                            setDuration={setDuration}
                            optimisticDuration={optimisticDuration}
                            setOptimisticDuration={setOptimisticDuration}
                            mostLikelyDuration={mostLikelyDuration}
                            setMostLikelyDuration={setMostLikelyDuration}
                            pessimisticDuration={pessimisticDuration}
                            setPessimisticDuration={setPessimisticDuration}
                            estimateRisk={estimateRisk}
                            setEstimateRisk={setEstimateRisk}
                            deadline={deadline}
                            setDeadline={setDeadline}
                            dependencies={dependencies}
                            setDependencies={setDependencies}
                            assignedTo={assignedTo}
                            setAssignedTo={setAssignedTo}
                            taskOptions={taskOptions}
                            tasks={tasks}
                            members={members}
                            saveTask={saveTask}
                            number={index + 1}
                            task={task}
                            key={task._id}
                            canEditTasks={canEditTasks}
                            canDeleteTasks={canDeleteTasks}
                        />
                    ))}
                </div>
            ) : (
                <h1 className={styles.groupHeader}>Список задач порожній</h1>
            )}
        </div>
    );
};

export default Group;