import React, { useState } from 'react';
import EditTaskForm from '../EditTaskForm/EditTaskForm';
import styles from './Task.module.css';
import { FaStar, FaPencilAlt, FaTrash, FaLock, FaLockOpen, FaInfoCircle, FaCheck } from 'react-icons/fa';

const Task = (props) => {
    const { task, taskOptions, tasks, members } = props;
    const [showDetails, setShowDetails] = useState(false);
    const [modalTaskEditVisible, setModalTaskEditVisible] = useState(false);

    const calculateDaysLeft = (deadline) => {
        if (!deadline) return '—';
        const today = new Date();
        const deadlineDate = new Date(deadline);
        const timeDiff = deadlineDate - today;
        const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
        return daysLeft >= 0 ? `${daysLeft} дн.` : 'Прострочено';
    };

    const toggleDetails = () => {
        setShowDetails(prev => !prev);
    };

    const handleEditTask = () => {
        props.editTask(task);
        setModalTaskEditVisible(true);
    };

    const assignedMember = task.assignedTo
        ? members.find(member => member._id === task.assignedTo)
        : null;

    return (
        <div className={`${styles.task} ${task.priority ? styles.priorityTask : ''} ${!task.status ? styles.completedTask : ''}`}>
            <div className={styles.taskInfo}>
                <div className={styles.taskHeader}>
                    {props.canEditTasks && (
                        <button onClick={() => props.priorityTask(task)} className={styles.iconButton} aria-label={task.priority ? 'Звичайний' : 'Пріоритетний'}>
                            <FaStar className={task.priority ? styles.activeIcon : ''} />
                            <span className={styles.tooltip}>{task.priority ? 'Звичайний' : 'Пріоритетний'}</span>
                        </button>    
                    )} 
                    <div className={styles.taskTitleWrapper}>
                        <div className={styles.taskTitle}>
                            {props.number}. {task.title}
                        </div>
                        {!task.status && (
                            <span className={styles.completedLabel}>
                                <FaCheck className={styles.checkIcon} /> Виконано
                            </span>
                        )}
                    </div>
                </div>
                {showDetails && (
                    <div className={styles.taskDetails}>
                        <span className={styles.detailLarge}>Тривалість: {task.duration} дн.</span>
                        <span className={styles.detailLarge}>Дедлайн: {task.deadline ? new Date(task.deadline).toLocaleDateString() : 'Не вказано'}</span>
                        <span className={styles.detailLarge}>Залишилось: {calculateDaysLeft(task.deadline)}</span>
                        <span className={styles.detailLarge}>Створено: {task.createdAt ? new Date(task.createdAt).toLocaleDateString() : '—'}</span>
                        <span className={styles.detailLarge}>
                            Виконавець: {assignedMember ? (assignedMember.fullName || assignedMember.email) : 'Не призначено'}
                        </span>
                        <span className={styles.detailLarge}>
                            Залежності: {task.dependencies.length 
                                ? task.dependencies.map(id => tasks.find(t => t._id === id)?.title).join(', ') 
                                : 'Немає'}
                        </span>
                    </div>
                )}
            </div>
            <div className={styles.taskButtons}>
                <button onClick={toggleDetails} className={styles.iconButton} aria-label="Деталі">
                    <FaInfoCircle className={showDetails ? styles.activeDetailsIcon : ''} />
                    <span className={styles.tooltip}>Деталі</span>
                </button>
                {props.canEditTasks && (
                    <>
                        <button onClick={handleEditTask} className={styles.iconButton} aria-label="Редагувати">
                            <FaPencilAlt />
                            <span className={styles.tooltip}>Редагувати</span>
                        </button>
                        <button onClick={() => props.statusTask(task)} className={styles.iconButton} aria-label={task.status ? 'Виконано' : 'Не виконано'}>
                            {task.status ? <FaLockOpen /> : <FaLock />}
                            <span className={styles.tooltip}>{task.status ? 'Виконано' : 'Не виконано'}</span>
                        </button>
                    </>
                )}
                {props.canDeleteTasks && (
                    <button onClick={() => props.removeTask(task)} className={styles.iconButton} aria-label="Видалити">
                        <FaTrash />
                        <span className={styles.tooltip}>Видалити</span>
                    </button> 
                )}
            </div>
            <EditTaskForm
                visible={modalTaskEditVisible}
                setVisible={setModalTaskEditVisible}
                value={props.value}
                setValue={props.setValue}
                duration={props.duration}
                setDuration={props.setDuration}
                optimisticDuration={props.optimisticDuration}
                setOptimisticDuration={props.setOptimisticDuration}
                mostLikelyDuration={props.mostLikelyDuration}
                setMostLikelyDuration={props.setMostLikelyDuration}
                pessimisticDuration={props.pessimisticDuration}
                setPessimisticDuration={props.setPessimisticDuration}
                estimateRisk={props.estimateRisk}
                setEstimateRisk={props.setEstimateRisk}
                deadline={props.deadline}
                setDeadline={props.setDeadline}
                dependencies={props.dependencies}
                setDependencies={props.setDependencies}
                assignedTo={props.assignedTo}
                setAssignedTo={props.setAssignedTo}
                taskOptions={taskOptions}
                members={members}
                saveTask={() => props.saveTask(task)}
                setEdit={props.setEdit}
            />
        </div>
    );
};

export default Task;