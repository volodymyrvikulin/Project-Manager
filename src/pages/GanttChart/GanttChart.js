import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGroups, selectGroups } from '../../redux/slices/groups';
import { selectIsAuth } from '../../redux/slices/auth';
import { Navigate, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MyButton from '../../components/ui/button/MyButton';
import AiRiskModal from '../../components/AiRiskModal/AiRiskModal';
import { FaArrowLeft, FaShieldAlt, FaClock } from 'react-icons/fa';
import styles from './GanttChart.module.css';
import { sortTasksWithDependencies, optimizeSchedule, calculateTimings, calculateTaskLevel, calculateDeadlineRisk, calculateProjectPert, getTaskTooltip, GANTT_TASK_ROW_HEIGHT } from '../../utils/ganttUtils';

const GanttChart = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { groupId: routeGroupId } = useParams();
    const [searchParams] = useSearchParams();
    const { groups } = useSelector(selectGroups);
    const isAuth = useSelector(selectIsAuth);
    const isGroupsLoading = groups.status === 'loading';

    const [useOptimizedSchedule, setUseOptimizedSchedule] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
    const [aiRiskGroup, setAiRiskGroup] = useState(null);

    const selectedGroupId = routeGroupId || searchParams.get('group') || 'all';

    const filteredGroups = groups.items.filter((group) => {
        if (selectedGroupId === 'all') return true;
        return group._id === selectedGroupId;
    });

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleToggleOptimization = () => {
        setUseOptimizedSchedule(prev => !prev);
    };

    if (!isAuth) {
        return <Navigate to="/login" />;
    }

    if (isGroupsLoading) {
        return <div>Завантаження...</div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.buttonWrapper}>
                <div className={styles.buttonGroupLeft}>
                    <MyButton
                        className={styles.backLink}
                        onClick={() => navigate('/')}
                    >
                        <FaArrowLeft /> Назад
                    </MyButton>
                </div>
            </div>
            <h1 className={styles.title}>Діаграма Ганта</h1>
            <div className={styles.controlsBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel} htmlFor="project-filter">
                        Проєкт:
                    </label>
                    <select
                        id="project-filter"
                        className={styles.projectSelect}
                        value={selectedGroupId}
                        onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'all') {
                                navigate('/gantt');
                            } else {
                                navigate(`/gantt?group=${val}`);
                            }
                        }}
                    >
                        <option value="all">Усі проєкти ({groups.items.length})</option>
                        {groups.items.map((g) => (
                            <option key={g._id} value={g._id}>
                                {g.title} ({g.tasks?.length || 0} задач)
                            </option>
                        ))}
                    </select>
                    {selectedGroupId !== 'all' && (
                        <button
                            type="button"
                            className={styles.resetFilterButton}
                            onClick={() => navigate('/gantt')}
                            title="Показати всі проєкти"
                        >
                            Всі проєкти
                        </button>
                    )}
                </div>
                <div className={styles.actionButtons}>
                    <MyButton
                        onClick={handleToggleOptimization}
                        className={useOptimizedSchedule ? styles.activeButton : ''}
                        title={useOptimizedSchedule ? 'Повернутися до початкового розкладу' : 'Оптимізувати розклад: усунути накладання задач у виконавців та збалансувати навантаження (RCPSP)'}
                    >
                        {useOptimizedSchedule ? '✕ Скасувати оптимізацію' : '⚡ Оптимізувати розклад'}
                    </MyButton>
                </div>
                <div className={styles.legend} aria-label="Легенда ризиків">
                    <span><i className={`${styles.legendSwatch} ${styles.legendNormal}`} /> Звичайна задача</span>
                    <span><i className={`${styles.legendSwatch} ${styles.legendMissed}`} /> Прострочена</span>
                    <span><i className={`${styles.legendSwatch} ${styles.legendMedium}`} /> Середній ризик</span>
                    <span><i className={`${styles.legendSwatch} ${styles.legendHigh}`} /> Високий ризик</span>
                </div>
            </div>
            {useOptimizedSchedule && (
                <div className={styles.optimizationBanner}>
                    <div className={styles.optimizationBannerTitle}>
                        <span>⚡ Розклад оптимізовано</span>
                    </div>
                    <div className={styles.optimizationBannerDesc}>
                        Усунено накладання задач у часі: задачі вишикувано за логічною послідовністю залежностей та дедлайнами, а роботу збалансовано між доступними виконавцями команди.
                    </div>
                </div>
            )}
            <div className={styles.ganttContainer}>
                {filteredGroups.length === 0 ? (
                    <div className={styles.emptyContainer}>
                        <p className={styles.emptyText}>Проєкт не знайдено або він був видалений.</p>
                        {selectedGroupId !== 'all' && (
                            <MyButton onClick={() => navigate('/gantt')}>Показати всі проєкти</MyButton>
                        )}
                    </div>
                ) : (
                    filteredGroups.map((group) => {
                        const groupId = group._id;
                        const members = group.members || [];
                        const groupTitle = group.title || 'Невідомий проєкт';
                        const groupCreatedAt = group.createdAt || new Date();
                        const rawTasks = group.tasks || [];

                        if (rawTasks.length === 0) {
                            return (
                                <div key={groupId} className={styles.groupSection}>
                                    <h2 className={styles.groupTitle}>
                                        <span className={styles.groupTitleText}>{groupTitle}</span>
                                    </h2>
                                    <div className={styles.emptyGroupState}>
                                        <p>У цьому проєкті ще немає створених задач.</p>
                                        <Link to="/">
                                            <MyButton>Перейти до списку задач</MyButton>
                                        </Link>
                                    </div>
                                </div>
                            );
                        }

                        const groupTasks = rawTasks.map((task) => ({
                            ...task,
                            groupId: group._id,
                            members: group.members,
                            earliestStartDate: new Date(task.earliestStartDate || task.createdAt),
                            earliestFinishDate: new Date(task.earliestFinishDate || task.deadline || task.createdAt),
                            latestFinishDate: new Date(task.deadline || task.earliestFinishDate || task.createdAt),
                            deadlineMissed: task.deadline && new Date(task.deadline) < new Date(),
                            assignedTo: task.assignedTo || null,
                            duration: task.duration || Math.ceil((new Date(task.earliestFinishDate) - new Date(task.earliestStartDate)) / (1000 * 60 * 60 * 24)),
                            dependencies: task.dependencies || [],
                        }));

                        let projectPert = calculateProjectPert(groupTasks);
                        const adjustedTasks = calculateTimings(groupTasks, groupCreatedAt)
                            .map(task => ({ ...task, ...calculateDeadlineRisk(task) }));

                        let ganttExecutors = [];
                        let unassignedTasks = [];

                        if (useOptimizedSchedule) {
                            ganttExecutors = optimizeSchedule(adjustedTasks, members, groupCreatedAt, group.permissions, group.user);
                            const assignedTaskIds = new Set(ganttExecutors.flatMap(exec => exec.tasks.map(task => String(task._id))));
                            unassignedTasks = adjustedTasks.filter(task => !assignedTaskIds.has(String(task._id)));

                            const allOptimizedTasks = [
                                ...ganttExecutors.flatMap(executor => executor.tasks),
                                ...unassignedTasks,
                            ];
                            projectPert = calculateProjectPert(allOptimizedTasks);
                        } else {
                            const minStartTimestamp = Math.min(...adjustedTasks.map(task => new Date(task.earliestStartDate).getTime()));
                            const baseMinStartDate = new Date(minStartTimestamp);

                            const assignedTasks = new Set();
                            const executorTasks = members.map(member => {
                                const memberTasks = adjustedTasks.filter(task => String(task.assignedTo) === String(member._id) && !assignedTasks.has(String(task._id)));
                                memberTasks.forEach(task => assignedTasks.add(String(task._id)));
                                const sortedTasks = [...memberTasks].sort((a, b) => new Date(a.earliestStartDate) - new Date(b.earliestStartDate));
                                const taskOffsets = new Map();
                                const occupiedIntervals = [];

                                sortedTasks.forEach((task) => {
                                    const startDay = Math.floor((new Date(task.earliestStartDate) - baseMinStartDate) / (1000 * 60 * 60 * 24));
                                    const taskDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - new Date(task.earliestStartDate)) / (1000 * 60 * 60 * 24));
                                    const endDay = startDay + taskDays;

                                    const level = calculateTaskLevel(occupiedIntervals, startDay, endDay);

                                    taskOffsets.set(task._id, level * GANTT_TASK_ROW_HEIGHT);
                                    occupiedIntervals.push({ startDay, endDay, level });
                                });

                                const maxLevel = Math.max(...Array.from(taskOffsets.values()).map(offset => offset / GANTT_TASK_ROW_HEIGHT), 0);
                                return {
                                    member,
                                    tasks: sortedTasks.map(task => ({
                                        ...task,
                                        offsetY: taskOffsets.get(task._id) || 0,
                                    })),
                                    maxLevel,
                                };
                            }).filter(executor => executor.tasks.length > 0);

                            ganttExecutors = executorTasks;
                            unassignedTasks = adjustedTasks.filter(task => !task.assignedTo || !members.some(member => String(member._id) === String(task.assignedTo)));
                        }

                        const activeTasks = useOptimizedSchedule
                            ? [...ganttExecutors.flatMap(e => e.tasks), ...unassignedTasks]
                            : adjustedTasks;

                        const minStartDate = new Date(Math.min(...activeTasks.map(task => new Date(task.earliestStartDate).getTime())));
                        const maxFinishDate = new Date(Math.max(...activeTasks.map(task => {
                            const start = new Date(task.earliestStartDate);
                            const durationDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - start) / (1000 * 60 * 60 * 24));
                            return new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
                        })));
                        let totalDays = Math.max(10, Math.ceil((maxFinishDate - minStartDate) / (1000 * 60 * 60 * 24)));
                        if (totalDays < 24) {
                            totalDays = 24;
                        }
                        const maxTaskEndDay = Math.max(...activeTasks.map(task => {
                            const startDay = Math.max(0, Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24)));
                            return startDay + Math.max(1, Number(task.duration) || 1);
                        }));
                        totalDays = Math.max(totalDays, maxTaskEndDay);
                        const availableWidth = Math.max(320, viewportWidth - 64);
                        const dayWidth = Math.max(8, Math.floor((availableWidth - 180) / totalDays));
                        const totalWidth = totalDays * dayWidth + 180;

                        const timelineDates = [];
                        for (let i = 0; i < totalDays; i++) {
                            const date = new Date(minStartDate);
                            date.setDate(minStartDate.getDate() + i);
                            timelineDates.push(date);
                        }

                    return (
                        <div key={groupId} className={styles.groupSection}>
                            <h2 className={styles.groupTitle}>
                                <span className={styles.groupTitleText}>{groupTitle}</span>
                                <span
                                    className={styles.pertSummary}
                                    title="Очікуваний час виконання проєкту з урахуванням тривалості задач та навантаження виконавців"
                                >
                                    <FaClock className={styles.pertSummaryIcon} />
                                    <span className={styles.pertSummaryLabel}>Прогноз завершення:</span>
                                    <span className={styles.pertSummaryValue}>
                                        {projectPert.expected.toFixed(1)} дн.
                                    </span>
                                    <span className={styles.pertSummaryDeviation}>
                                        ± {projectPert.standardDeviation.toFixed(1)} дн.
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className={styles.aiRiskButton}
                                    onClick={() => setAiRiskGroup({ id: groupId, title: groupTitle })}
                                    title="AI-аналіз ризиків та практичні рекомендації"
                                >
                                    <FaShieldAlt className={styles.aiRiskIcon} />
                                    <span>AI-аналіз ризиків</span>
                                </button>
                            </h2>
                            <div className={styles.scrollableSection}>
                                <div className={styles.ganttWrapper}>
                                    <div
                                        className={styles.ganttTimelineWrapper}
                                        style={{ width: `${totalWidth}px` }}
                                    >
                                        <div className={styles.ganttTimelineSpacer} />
                                        <div className={styles.ganttTimeline}>
                                            {timelineDates.map((date, index) => (
                                                <div
                                                    key={index}
                                                    className={styles.ganttTimelineCell}
                                                    style={{ width: `${dayWidth}px` }}
                                                >
                                                    {date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div
                                        className={styles.ganttBody}
                                        style={{ width: `${totalWidth}px` }}
                                    >
                                        {ganttExecutors.map((executor, executorIndex) => (
                                            <div
                                                key={executorIndex}
                                                className={styles.ganttRow}
                                                style={{ height: `${(executor.maxLevel + 1) * GANTT_TASK_ROW_HEIGHT + 18}px`, minHeight: `${GANTT_TASK_ROW_HEIGHT + 18}px` }}
                                            >
                                                <div className={styles.ganttExecutorLabel}>
                                                    <div className={styles.executorLabelContent}>
                                                        <span
                                                            className={styles.executorName}
                                                            title={executor.member?.fullName || executor.member?.email || `Виконавець ${executorIndex + 1}`}
                                                        >
                                                            {executor.member?.fullName || executor.member?.email || `Виконавець ${executorIndex + 1}`}
                                                        </span>
                                                        {useOptimizedSchedule && (
                                                            <span className={styles.optimizedBadge} title="Задачі збалансовано без накладок">
                                                                ✓ Збалансовано
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    className={styles.ganttRowContent}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)`,
                                                        width: `${totalDays * dayWidth}px`,
                                                    }}
                                                >
                                                    {executor.tasks.map(task => {
                                                        const startDay = Math.min(totalDays - 1, Math.max(0, Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24))));
                                                        const rawTaskDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - new Date(task.earliestStartDate)) / (1000 * 60 * 60 * 24));
                                                        const taskDays = Math.max(1, Math.min(rawTaskDays, totalDays - startDay));
                                                        const calculatedWidth = taskDays * dayWidth;
                                                        const taskWidth = Math.max(calculatedWidth, 30);
                                                        return (
                                                            <div
                                                                key={task._id}
                                                                className={`${styles.ganttTask} ${task.deadlineMissed ? styles.ganttTaskMissed : styles.ganttTaskNormal} ${styles[`ganttTaskRisk${task.riskLevel ? (task.riskLevel[0].toUpperCase() + task.riskLevel.slice(1)) : 'Low'}`]} ${task.autoAssigned ? styles.ganttTaskAutoAssigned : ''}`}
                                                                style={{
                                                                    gridColumn: `${startDay + 1} / span ${taskDays}`,
                                                                        gridRow: `${(task.offsetY || 0) / GANTT_TASK_ROW_HEIGHT + 1}`,
                                                                    width: `${taskWidth}px`,
                                                                }}
                                                            >
                                                                <div
                                                                    className={styles.ganttTaskContent}
                                                                    title={getTaskTooltip(task)}
                                                                >
                                                                    <strong>{task.title}</strong>
                                                                    {task.delayDays > 0 && (
                                                                        <span className={styles.delayBadge} title={`Зсув розкладу: +${task.delayDays} дн. через зайнятість виконавця`}>
                                                                            +{task.delayDays}д
                                                                        </span>
                                                                    )}
                                                                    {task.autoAssigned && (
                                                                        <span className={styles.autoAssignedBadge} title="Автоматично призначено оптимізатором розкладу">
                                                                            ⚡
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {unassignedTasks.length > 0 && (
                                            <div
                                                className={styles.ganttRow}
                                                style={{
                                                    height: `${Math.max(150, unassignedTasks.length * GANTT_TASK_ROW_HEIGHT + 18)}px`,
                                                    minHeight: `${GANTT_TASK_ROW_HEIGHT + 18}px`,
                                                }}
                                            >
                                                <div className={styles.ganttExecutorLabel}>
                                                    Непризначені задачі
                                                </div>
                                                <div
                                                    className={styles.ganttRowContent}
                                                    style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: `repeat(${totalDays}, ${dayWidth}px)`,
                                                        width: `${totalDays * dayWidth}px`,
                                                    }}
                                                >
                                                    {(() => {
                                                        const sortedUnassignedTasks = sortTasksWithDependencies(unassignedTasks);
                                                        const taskOffsets = new Map();
                                                        const occupiedIntervals = [];

                                                        sortedUnassignedTasks.forEach((task, index) => {
                                                            const startDay = Math.min(totalDays - 1, Math.max(0, Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24))));
                                                            const rawTaskDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - new Date(task.earliestStartDate)) / (1000 * 60 * 60 * 24));
                                                            const taskDays = Math.max(1, Math.min(rawTaskDays, totalDays - startDay));
                                                            const endDay = startDay + taskDays;

                                                            const level = calculateTaskLevel(occupiedIntervals, startDay, endDay);

                                                            taskOffsets.set(task._id, level * GANTT_TASK_ROW_HEIGHT);
                                                            occupiedIntervals.push({ startDay, endDay, level });
                                                        });

                                                        return sortedUnassignedTasks.map(task => {
                                                            const startDay = Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24));
                                                            const taskDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - new Date(task.earliestStartDate)) / (1000 * 60 * 60 * 24));
                                                            const calculatedWidth = taskDays * dayWidth;
                                                            const taskWidth = Math.max(calculatedWidth, 30);
                                                            const offsetY = taskOffsets.get(task._id) || 0;
                                                            return (
                                                                <div
                                                                    key={task._id}
                                                                    className={`${styles.ganttTask} ${task.deadlineMissed ? styles.ganttTaskMissed : styles.ganttTaskNormal} ${styles[`ganttTaskRisk${task.riskLevel[0].toUpperCase()}${task.riskLevel.slice(1)}`]}`}
                                                                    style={{
                                                                        gridColumn: `${startDay + 1} / span ${taskDays}`,
                                                                        gridRow: `${offsetY / GANTT_TASK_ROW_HEIGHT + 1}`,
                                                                        width: `${taskWidth}px`,
                                                                    }}
                                                                >
                                                                    <div
                                                                        className={styles.ganttTaskContent}
                                                                        title={getTaskTooltip(task)}
                                                                    >
                                                                        <strong>{task.title}</strong>
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }))}
            </div>
            <AiRiskModal
                visible={Boolean(aiRiskGroup)}
                setVisible={(open) => !open && setAiRiskGroup(null)}
                groupId={aiRiskGroup?.id}
                groupTitle={aiRiskGroup?.title}
            />
        </div>
    );
};

export default GanttChart;