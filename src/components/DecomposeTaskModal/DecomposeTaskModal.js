import React, { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { fetchDecomposeTask, fetchCreateTask, fetchUpdateTask } from '../../redux/slices/groups';
import MyModal from '../ui/modal/MyModal';
import {
    FaSitemap,
    FaMagic,
    FaTimes,
    FaRobot,
    FaClock,
    FaLink,
} from 'react-icons/fa';
import styles from './DecomposeTaskModal.module.css';

const DecomposeTaskModal = ({ visible, setVisible, task, groupId }) => {
    const dispatch = useDispatch();

    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [subtasks, setSubtasks] = useState([]);
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [linkToParentDependencies, setLinkToParentDependencies] = useState(true);
    const [markParentCompleted, setMarkParentCompleted] = useState(false);

    useEffect(() => {
        if (visible) {
            setPrompt('');
            setError('');
            setSubtasks([]);
            setSelectedIndices(new Set());
            setLinkToParentDependencies(true);
            setMarkParentCompleted(false);
        }
    }, [visible, task]);

    if (!task) return null;

    const handleGenerate = async (e) => {
        if (e) e.preventDefault();
        setError('');
        setIsGenerating(true);

        try {
            const result = await dispatch(fetchDecomposeTask({
                groupId,
                taskId: task._id,
                prompt,
            })).unwrap();

            const generated = result.subtasks || [];
            setSubtasks(generated);
            setSelectedIndices(new Set(generated.map((_, index) => index)));
        } catch (err) {
            setError(err?.message || 'Не вдалося декомпозувати задачу');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleToggleSelect = (index) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIndices.size === subtasks.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(subtasks.map((_, i) => i)));
        }
    };

    const handleTitleChange = (index, newTitle) => {
        setSubtasks(prev => prev.map((item, idx) => (
            idx === index ? { ...item, title: newTitle } : item
        )));
    };

    const handleSaveSubtasks = async () => {
        if (selectedIndices.size === 0) return;
        setIsSaving(true);
        setError('');

        try {
            const createdSubtasks = [];

            // Map old subtask indices to created subtasks
            for (let i = 0; i < subtasks.length; i++) {
                if (!selectedIndices.has(i)) continue;

                const item = subtasks[i];
                const { dependencyIndices, ...taskData } = item;

                // Resolve dependencies within created subtasks
                const resolvedDeps = (dependencyIndices || [])
                    .map((depIndex) => createdSubtasks[depIndex]?._id)
                    .filter(Boolean);

                // If subtask has no internal prerequisites and option is checked, inherit parent dependencies
                if (resolvedDeps.length === 0 && linkToParentDependencies && task.dependencies?.length) {
                    resolvedDeps.push(...task.dependencies);
                }

                const created = await dispatch(fetchCreateTask({
                    newTask: {
                        ...taskData,
                        dependencies: Array.from(new Set(resolvedDeps)),
                    },
                    id: groupId,
                })).unwrap();

                createdSubtasks[i] = created;
            }

            // Optionally mark parent task as completed
            if (markParentCompleted && task.status) {
                await dispatch(fetchUpdateTask({
                    updatedTask: {
                        ...task,
                        status: false,
                    },
                    groupId,
                    taskId: task._id,
                })).unwrap();
            }

            setVisible(false);
        } catch (err) {
            setError(err?.message || 'Помилка при збереженні підзадач');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <MyModal visible={visible} setVisible={setVisible} contentClassName={styles.customModalContent}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <FaSitemap className={styles.headerIcon} />
                        <div>
                            <h2 className={styles.title}>Декомпозиція задачі з ШІ</h2>
                            <p className={styles.projectSubtitle}>
                                Автоматичний поділ задачі на покрокові етапи з оцінкою часу
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setVisible(false)}
                        className={styles.closeButton}
                        aria-label="Закрити"
                    >
                        <FaTimes />
                    </button>
                </div>

                <div className={styles.contentScroll}>
                    <div className={styles.parentTaskBanner}>
                        <span className={styles.parentTaskLabel}>Вихідна задача</span>
                        <span className={styles.parentTaskTitle}>{task.title}</span>
                        {task.description && (
                            <p className={styles.parentTaskDescription}>{task.description}</p>
                        )}
                        <span className={styles.parentTaskMeta}>
                            Очікувана тривалість: {task.pert?.expected ? `${task.pert.expected.toFixed(1)} дн.` : `${task.duration} дн.`}
                            {task.deadline ? ` | Дедлайн: ${new Date(task.deadline).toLocaleDateString('uk-UA')}` : ''}
                        </span>
                    </div>

                    <form className={styles.formSection} onSubmit={handleGenerate}>
                        <label className={styles.label} htmlFor="decompose-prompt">
                            Додаткові побажання до декомпозиції (необов'язково)
                        </label>
                        <div className={styles.inputRow}>
                            <textarea
                                id="decompose-prompt"
                                className={styles.textarea}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Наприклад: розбити на 3 логічні етапи (дизайн, верстка, інтеграція)"
                                rows="2"
                                disabled={isGenerating || isSaving}
                            />
                            <button
                                type="submit"
                                className={styles.generateBtn}
                                disabled={isGenerating || isSaving}
                            >
                                <FaMagic /> {subtasks.length > 0 ? 'Згенерувати заново' : 'Згенерувати підзадачі'}
                            </button>
                        </div>
                    </form>

                    {error && (
                        <div className={styles.errorBanner} role="alert">
                            {error}
                        </div>
                    )}

                    {isGenerating && (
                        <div className={styles.loadingContainer}>
                            <FaRobot className={styles.robotSpinner} />
                            <p className={styles.loadingText}>
                                ШІ аналізує структуру задачі та розбиває її на конкретні кроки з оцінкою часу...
                            </p>
                        </div>
                    )}

                    {!isGenerating && subtasks.length > 0 && (
                        <>
                            <div className={styles.subtasksHeader}>
                                <h3 className={styles.sectionTitle}>
                                    Згенеровані підзадачі ({subtasks.length})
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className={styles.selectAllBtn}
                                >
                                    {selectedIndices.size === subtasks.length ? 'Зняти виділення' : 'Вибрати всі'}
                                </button>
                            </div>

                            <ul className={styles.subtasksList}>
                                {subtasks.map((subtask, index) => {
                                    const isSelected = selectedIndices.has(index);
                                    const depIndices = subtask.dependencyIndices || [];
                                    const pert = subtask.pert || {};

                                    return (
                                        <li
                                            key={index}
                                            className={`${styles.subtaskCard} ${isSelected ? styles.subtaskCardActive : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                className={styles.checkbox}
                                                checked={isSelected}
                                                onChange={() => handleToggleSelect(index)}
                                                id={`subtask-check-${index}`}
                                            />
                                            <div className={styles.subtaskContent}>
                                                <input
                                                    type="text"
                                                    className={styles.subtaskTitleInput}
                                                    value={subtask.title}
                                                    onChange={(e) => handleTitleChange(index, e.target.value)}
                                                    placeholder="Назва підзадачі"
                                                />
                                                {subtask.description && (
                                                    <p className={styles.subtaskDescriptionText}>{subtask.description}</p>
                                                )}
                                                <div className={styles.subtaskBadges}>
                                                    <span className={styles.pertBadge}>
                                                        <FaClock /> Оцінка часу: {subtask.duration} дн. (мін: {pert.optimistic}, очік: {pert.mostLikely}, макс: {pert.pessimistic} дн.)
                                                    </span>
                                                    {depIndices.length > 0 && (
                                                        <span className={styles.dependencyBadge}>
                                                            <FaLink /> Залежить від: {depIndices.map((i) => `#${i + 1}`).join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>

                            <div className={styles.optionsSection}>
                                {task.dependencies?.length > 0 && (
                                    <label className={styles.optionLabel}>
                                        <input
                                            type="checkbox"
                                            checked={linkToParentDependencies}
                                            onChange={(e) => setLinkToParentDependencies(e.target.checked)}
                                        />
                                        <span>Прив'язати перші підзадачі до залежностей вихідної задачі</span>
                                    </label>
                                )}
                                <label className={styles.optionLabel}>
                                    <input
                                        type="checkbox"
                                        checked={markParentCompleted}
                                        onChange={(e) => setMarkParentCompleted(e.target.checked)}
                                    />
                                    <span>Позначити вихідну задачу як виконану після створення підзадач</span>
                                </label>
                            </div>
                        </>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => setVisible(false)}
                        disabled={isSaving}
                    >
                        Скасувати
                    </button>
                    {subtasks.length > 0 && (
                        <div className={styles.footerRight}>
                            <button
                                type="button"
                                className={styles.saveBtn}
                                onClick={handleSaveSubtasks}
                                disabled={isSaving || selectedIndices.size === 0}
                            >
                                {isSaving
                                    ? 'Створення...'
                                    : `Додати підзадачі (${selectedIndices.size})`}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </MyModal>
    );
};

export default DecomposeTaskModal;

