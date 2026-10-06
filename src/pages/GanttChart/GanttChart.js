import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGroups, selectGroups } from '../../redux/slices/groups';
import { selectIsAuth } from '../../redux/slices/auth';
import { Navigate, Link } from 'react-router-dom';
import MyButton from '../../components/ui/button/MyButton';
import styles from './GanttChart.module.css';
import { sortTasksWithDependencies, optimizeSchedule, calculateTimings, calculateTaskLevel, calculateDeadlineRisk, calculateProjectPert, GANTT_TASK_ROW_HEIGHT } from '../../utils/ganttUtils';

const GanttChart = () => {
    const dispatch = useDispatch();
    const { groups } = useSelector(selectGroups);
    const isAuth = useSelector(selectIsAuth);
    const isGroupsLoading = groups.status === 'loading';

    const [useOptimizedSchedule, setUseOptimizedSchedule] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(window.innerWidth);

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const ganttData = groups.items.flatMap(group =>
        group.tasks.map(task => ({
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
        }))
    );

    const handleToggleOptimization = () => {
        setUseOptimizedSchedule(prev => !prev);
    };

    const groupedTasks = ganttData.reduce((acc, task) => {
        const groupId = task.groupId;
        if (!acc[groupId]) {
            acc[groupId] = {
                tasks: [],
                members: task.members || [],
            };
        }
        acc[groupId].tasks.push(task);
        return acc;
    }, {});

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
                    <Link to="/" className={styles.backLink}>
                        <MyButton>Назад</MyButton>
                    </Link>
                </div>
            </div>
            <h1 className={styles.title}>Діаграма Ганта</h1>
            <div className={styles.optimizationButtonWrapper}>
                    <MyButton
                    onClick={handleToggleOptimization}
                    className={useOptimizedSchedule ? styles.activeButton : ''}
                >
                    {useOptimizedSchedule ? 'Скасувати оптимізацію' : 'Оптимізувати розклад'}
                </MyButton>
                    <div className={styles.legend} aria-label="Легенда ризиків">
                        <span><i className={`${styles.legendSwatch} ${styles.legendNormal}`} /> Звичайна задача</span>
                        <span><i className={`${styles.legendSwatch} ${styles.legendMissed}`} /> Прострочена</span>
                        <span><i className={`${styles.legendSwatch} ${styles.legendMedium}`} /> Середній ризик</span>
                        <span><i className={`${styles.legendSwatch} ${styles.legendHigh}`} /> Високий ризик</span>
                    </div>
            </div>
            <div className={styles.ganttContainer}>
                {Object.keys(groupedTasks).map(groupId => {
                    const { tasks: groupTasks, members } = groupedTasks[groupId];
                    const group = groups.items.find(g => g._id === groupId);
                    const groupTitle = group ? group.title : 'Невідомий проєкт';
                    const groupCreatedAt = group?.createdAt || new Date();
                    let projectPert = calculateProjectPert(groupTasks);

                    const adjustedTasks = calculateTimings(groupTasks, groupCreatedAt)
                        .map(task => ({ ...task, ...calculateDeadlineRisk(task) }));
                    const minStartDate = new Date(Math.min(...adjustedTasks.map(task => task.earliestStartDate)));
                    const maxFinishDate = new Date(Math.max(...adjustedTasks.map(task => {
                        const start = new Date(task.earliestStartDate);
                        const durationDays = task.duration || Math.ceil((new Date(task.earliestFinishDate) - start) / (1000 * 60 * 60 * 24));
                        return new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
                    })));
                    let totalDays = Math.max(10, Math.ceil((maxFinishDate - minStartDate) / (1000 * 60 * 60 * 24)));
                    if (totalDays < 24) {
                        totalDays = 24;
                    }
                    const maxTaskEndDay = Math.max(...adjustedTasks.map(task => {
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

                    let ganttExecutors = [];
                    let unassignedTasks = [];

                    if (useOptimizedSchedule) {
                        ganttExecutors = optimizeSchedule(adjustedTasks, members, groupCreatedAt);
                        const assignedTaskIds = new Set(ganttExecutors.flatMap(exec => exec.tasks.map(task => task._id)));
                        unassignedTasks = adjustedTasks.filter(task => !assignedTaskIds.has(task._id));

                        const optimizedTasks = ganttExecutors.flatMap((executor, executorIndex) =>
                            executor.tasks.map(task => ({
                                ...task,
                                assignedTo: `optimized-executor-${executorIndex}`,
                            }))
                        );
                        projectPert = calculateProjectPert([...optimizedTasks, ...unassignedTasks]);
                    } else {
                        const assignedTasks = new Set();
                        const executorTasks = members.map(member => {
                            const memberTasks = adjustedTasks.filter(task => task.assignedTo === member._id && !assignedTasks.has(task._id));
                            memberTasks.forEach(task => assignedTasks.add(task._id));
                            const sortedTasks = [...memberTasks].sort((a, b) => new Date(a.earliestStartDate) - new Date(b.earliestStartDate));
                            const taskOffsets = new Map();
                            const occupiedIntervals = [];

                            sortedTasks.forEach((task, index) => {
                                const startDay = Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24));
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
                        unassignedTasks = adjustedTasks.filter(task => !task.assignedTo || !members.some(member => member._id === task.assignedTo));
                    }

                    return (
                        <div key={groupId} className={styles.groupSection}>
                            <h2 className={styles.groupTitle}>
                                {groupTitle}
                                <span
                                    className={styles.pertSummary}
                                    title="Прогноз розраховано методом PERT на основі критичного шляху та невизначеності оцінок задач"
                                >
                                    Прогноз завершення: {projectPert.expected.toFixed(1)} дн. ± {projectPert.standardDeviation.toFixed(1)} дн.
                                </span>
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
                                                    {useOptimizedSchedule
                                                        ? `Виконавець ${executorIndex + 1}`
                                                        : (executor.member?.fullName || executor.member?.email || `Виконавець ${executorIndex + 1}`)}
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
                                                                className={`${styles.ganttTask} ${task.deadlineMissed ? styles.ganttTaskMissed : styles.ganttTaskNormal} ${styles[`ganttTaskRisk${task.riskLevel[0].toUpperCase()}${task.riskLevel.slice(1)}`]}`}
                                                                style={{
                                                                    gridColumn: `${startDay + 1} / span ${taskDays}`,
                                                                        gridRow: `${(task.offsetY || 0) / GANTT_TASK_ROW_HEIGHT + 1}`,
                                                                    width: `${taskWidth}px`,
                                                                }}
                                                            >
                                                                <div className={styles.ganttTaskContent} title={`${task.title}. Ризик: ${task.riskScore}%. ${task.riskReason}`}>
                                                                    <strong>{task.title}</strong>
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
                                                                    <div className={styles.ganttTaskContent} title={`${task.title}. Ризик: ${task.riskScore}%. ${task.riskReason}`}>
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
                })}
            </div>
        </div>
    );
};

export default GanttChart;