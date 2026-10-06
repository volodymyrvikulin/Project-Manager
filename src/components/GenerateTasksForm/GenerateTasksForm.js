import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import MyButton from '../ui/button/MyButton';
import { fetchCreateTask, fetchGenerateTasks } from '../../redux/slices/groups';
import styles from './GenerateTasksForm.module.css';

const GenerateTasksForm = ({ setVisible, id }) => {
    const [description, setDescription] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState('');
    const dispatch = useDispatch();

    const generateTasks = async (event) => {
        event.preventDefault();
        setGenerationError('');
        setIsGenerating(true);

        try {
            const generatedTasks = await dispatch(fetchGenerateTasks({
                description,
                id,
            })).unwrap();

            await Promise.all(generatedTasks.map((task) => dispatch(fetchCreateTask({
                newTask: task,
                id,
            })).unwrap()));

            setDescription('');
            setVisible(false);
        } catch (error) {
            setGenerationError(error?.message || 'Не вдалося згенерувати задачі');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Генерація задач</h2>
            <form className={styles.form} onSubmit={generateTasks}>
                <label className={styles.label} htmlFor="ai-task-description">
                    Опишіть ціль або функціональність
                </label>
                <textarea
                    className={styles.textarea}
                    id="ai-task-description"
                    value={description}
                    onChange={event => setDescription(event.target.value)}
                    placeholder="Опишіть функціональність або частину проєкту"
                    rows="5"
                />
                <MyButton
                    className={styles.button}
                    type="submit"
                    disabled={isGenerating || description.trim().length < 10}
                >
                    {isGenerating ? 'Генерація...' : 'Згенерувати задачі'}
                </MyButton>
                {generationError && <p className={styles.error} role="alert">{generationError}</p>}
            </form>
        </div>
    );
};

export default GenerateTasksForm;