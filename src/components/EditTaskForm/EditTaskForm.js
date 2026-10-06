import React from 'react';
import MyButton from '../ui/button/MyButton';
import MyInput from '../ui/input/MyInput';
import MyCheckboxList from '../ui/checkbox/MyCheckboxList';
import MySelect from '../ui/select/MySelect';
import MyModal from '../ui/modal/MyModal';
import styles from './EditTaskForm.module.css';

const EditTaskForm = ({ visible, setVisible, value, setValue, duration, setDuration, optimisticDuration, setOptimisticDuration, mostLikelyDuration, setMostLikelyDuration, pessimisticDuration, setPessimisticDuration, estimateRisk, setEstimateRisk, deadline, setDeadline, dependencies, setDependencies, taskOptions, members, saveTask, setEdit, assignedTo, setAssignedTo }) => {
    const handleSave = () => {
        saveTask();
        setVisible(false);
    };

    const handleCancel = () => {
        setValue('');
        setDuration(1);
        setOptimisticDuration(1);
        setMostLikelyDuration(1);
        setPessimisticDuration(1);
        setEstimateRisk(false);
        setDeadline('');
        setDependencies([]);
        setAssignedTo('');
        setEdit(null);
        setVisible(false);
    };

    const memberOptions = members.map(member => ({
        value: member._id,
        name: member.fullName || member.email,
    }));

    return (
        <MyModal visible={visible} setVisible={setVisible}>
            <div className={styles.editForm}>
                <h3>Редагувати задачу</h3>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-task-title">Назва задачі</label>
                    <MyInput id="edit-task-title" value={value} onChange={e => setValue(e.target.value)} type="text" placeholder="Введіть назву задачі" />
                </div>
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-task-duration">Базова тривалість (дні)</label>
                    <MyInput id="edit-task-duration" value={duration} onChange={e => setDuration(e.target.value)} type="number" placeholder="Вкажіть тривалість" min="1" />
                </div>
                <MyButton
                    type="button"
                    className={styles.riskButton}
                    onClick={() => setEstimateRisk(prev => !prev)}
                >
                    {estimateRisk ? 'Сховати оцінки ризику' : 'Оцінити ризики'}
                </MyButton>
                {estimateRisk && (
                    <>
                        <div className={styles.field}><label className={styles.fieldLabel}>Оптимістичний час (дні)</label><MyInput value={optimisticDuration} onChange={e => setOptimisticDuration(e.target.value)} type="number" min="1" placeholder="За сприятливих умов" /></div>
                        <div className={styles.field}><label className={styles.fieldLabel}>Найбільш імовірний час (дні)</label><MyInput value={mostLikelyDuration} onChange={e => setMostLikelyDuration(e.target.value)} type="number" min="1" placeholder="Звичайний сценарій" /></div>
                        <div className={styles.field}><label className={styles.fieldLabel}>Песимістичний час (дні)</label><MyInput value={pessimisticDuration} onChange={e => setPessimisticDuration(e.target.value)} type="number" min="1" placeholder="З урахуванням ризиків" /></div>
                    </>
                )}
                <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="edit-task-deadline">Дедлайн (опціонально)</label>
                    <MyInput id="edit-task-deadline" value={deadline} onChange={e => setDeadline(e.target.value)} type="date" aria-label="Дедлайн (опціонально)" />
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
                <div className={styles.editButtons}>
                    <MyButton onClick={handleSave}>Зберегти</MyButton>
                    <MyButton onClick={handleCancel}>Скасувати</MyButton>
                </div>
            </div>
        </MyModal>
    );
};

export default EditTaskForm;