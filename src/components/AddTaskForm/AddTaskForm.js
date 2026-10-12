import React, { useState } from 'react';
import MyButton from '../ui/button/MyButton';
import MyInput from '../ui/input/MyInput';
import MyCheckboxList from '../ui/checkbox/MyCheckboxList';
import MySelect from '../ui/select/MySelect';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCreateTask } from '../../redux/slices/groups';
import { selectGroups } from '../../redux/slices/groups';
import styles from './AddTaskForm.module.css';

const AddTaskForm = ({ setVisible, id }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dependencies, setDependencies] = useState([]);
    const [duration, setDuration] = useState(1);
    const [optimisticDuration, setOptimisticDuration] = useState(1);
    const [mostLikelyDuration, setMostLikelyDuration] = useState(1);
    const [pessimisticDuration, setPessimisticDuration] = useState(1);
    const [estimateRisk, setEstimateRisk] = useState(false);
    const [deadline, setDeadline] = useState('');
    const [assignedTo, setAssignedTo] = useState('');
    const dispatch = useDispatch();
    const { groups } = useSelector(selectGroups);
    const group = groups.items.find(g => g._id === id);

    const addNewTask = (e) => {
        e.preventDefault();
        const newTask = {
            title,
            description: description ? description.trim() : '',
            status: true,
            priority: false,
            dependencies: dependencies || [],
            duration: Number(duration),
            pert: estimateRisk
                ? (() => {
                    const optimistic = Math.max(1, Number(optimisticDuration) || Number(duration) || 1);
                    const mostLikely = Math.max(optimistic, Number(mostLikelyDuration) || optimistic);
                    const pessimistic = Math.max(mostLikely, Number(pessimisticDuration) || mostLikely);
                    const expected = (optimistic + (4 * mostLikely) + pessimistic) / 6;
                    const standardDeviation = (pessimistic - optimistic) / 6;
                    return {
                        optimistic,
                        mostLikely,
                        pessimistic,
                        expected,
                        standardDeviation,
                        variance: standardDeviation ** 2,
                    };
                })()
                : {
                    optimistic: Math.max(1, Number(duration) || 1),
                    mostLikely: Math.max(1, Number(duration) || 1),
                    pessimistic: Math.max(1, Number(duration) || 1),
                    expected: Math.max(1, Number(duration) || 1),
                    standardDeviation: 0,
                    variance: 0,
                },
            deadline: deadline ? new Date(deadline).toISOString() : undefined,
            assignedTo: assignedTo || null,
        };
        dispatch(fetchCreateTask({ newTask, id }));
        setVisible(false);
        setTitle('');
        setDescription('');
        setDependencies([]);
        setDuration(1);
        setOptimisticDuration(1);
        setMostLikelyDuration(1);
        setPessimisticDuration(1);
        setEstimateRisk(false);
        setDeadline('');
        setAssignedTo('');
    };

    const taskOptions = group?.tasks.map(task => ({
        value: task._id,
        name: task.title,
    })) || [];

    const memberOptions = group?.members.map(member => ({
        value: member._id,
        name: member.fullName || member.email,
    })) || [];

    return (
        <div className={styles.container}>
            <form className={styles.form}>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="task-title">Назва задачі</label>
                    <MyInput id="task-title" value={title} onChange={e => setTitle(e.target.value)} type="text" placeholder="Введіть назву задачі" />
                </div>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="task-description">Опис задачі (опціонально)</label>
                    <textarea
                        id="task-description"
                        className={styles.textarea}
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Введіть опис або деталі задачі"
                        rows="3"
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="task-duration">Базова тривалість (дні)</label>
                    <MyInput
                        id="task-duration"
                        value={duration}
                        onChange={e => {
                            const value = e.target.value;
                            setDuration(value);
                            setOptimisticDuration(value);
                            setMostLikelyDuration(value);
                            setPessimisticDuration(value);
                        }}
                        type="number"
                        placeholder="Вкажіть тривалість"
                        min="1"
                    />
                </div>
                <MyButton
                    className={styles.riskButton}
                    type="button"
                    onClick={() => setEstimateRisk(prev => !prev)}
                >
                    {estimateRisk ? 'Сховати оцінки ризику' : 'Оцінити ризики'}
                </MyButton>
                {estimateRisk && (
                    <>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Оптимістичний час (дні)</label>
                            <MyInput value={optimisticDuration} onChange={e => setOptimisticDuration(e.target.value)} type="number" placeholder="За сприятливих умов" min="1" />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Найбільш імовірний час (дні)</label>
                            <MyInput value={mostLikelyDuration} onChange={e => setMostLikelyDuration(e.target.value)} type="number" placeholder="Звичайний сценарій" min="1" />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.fieldLabel}>Песимістичний час (дні)</label>
                            <MyInput value={pessimisticDuration} onChange={e => setPessimisticDuration(e.target.value)} type="number" placeholder="З урахуванням ризиків" min="1" />
                        </div>
                    </>
                )}
                <div className={styles.deadlineField}>
                    <label className={styles.fieldLabel} htmlFor="task-deadline">
                        Дедлайн (опціонально)
                    </label>
                    <MyInput
                        id="task-deadline"
                        value={deadline}
                        onChange={e => setDeadline(e.target.value)}
                        type="date"
                        aria-label="Дедлайн (опціонально)"
                    />
                </div>
                <MyCheckboxList
                    value={dependencies}
                    onChange={setDependencies}
                    label="Залежності (опціонально)"
                    options={taskOptions}
                />
                <MySelect
                    value={assignedTo}
                    onChange={setAssignedTo}
                    label="Виконавець (опціонально)"
                    options={memberOptions}
                    defaultOption="Оберіть виконавця"
                />
                <MyButton className={styles.submitButton} onClick={addNewTask}>Додати задачу</MyButton>
            </form>
        </div>
    );
};

export default AddTaskForm;