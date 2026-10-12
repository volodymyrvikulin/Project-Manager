import React, { useEffect, useState, useMemo } from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    Title,
    BarElement,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchGroups, selectGroups } from '../../redux/slices/groups';
import { selectIsAuth } from '../../redux/slices/auth';
import MyButton from '../../components/ui/button/MyButton';
import AiRiskModal from '../../components/AiRiskModal/AiRiskModal';
import {
    calculateProjectPert,
    calculateTimings,
    calculateDeadlineRisk,
    extractId,
    getTaskExpectedDuration,
} from '../../utils/ganttUtils';
import {
    FaArrowLeft,
    FaRobot,
    FaTasks,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaShieldAlt,
    FaUsers,
    FaChartBar,
    FaProjectDiagram,
    FaCalendarAlt,
    FaFolderOpen,
} from 'react-icons/fa';
import styles from './TaskStatistics.module.css';

ChartJS.register(ArcElement, Tooltip, Legend, Title, BarElement, CategoryScale, LinearScale, LineElement, PointElement);

const TaskStatistics = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const isAuth = useSelector(selectIsAuth);
    const { groups, riskAnalysis } = useSelector(selectGroups);
    const isGroupsLoading = groups.status === 'loading';

    const searchParams = new URLSearchParams(location.search);
    const urlGroupId = searchParams.get('group');
    const stateGroupId = location.state?.statistics?._id;

    const [selectedGroupId, setSelectedGroupId] = useState(urlGroupId || stateGroupId || 'all');
    const [aiModalVisible, setAiModalVisible] = useState(false);

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    useEffect(() => {
        if (urlGroupId) {
            setSelectedGroupId(urlGroupId);
        } else if (stateGroupId) {
            setSelectedGroupId(stateGroupId);
        }
    }, [urlGroupId, stateGroupId]);

    const handleSelectGroup = (groupId) => {
        setSelectedGroupId(groupId);
        if (groupId === 'all') {
            navigate('/statistics', { replace: true, state: {} });
        } else {
            navigate(`/statistics?group=${groupId}`, { replace: true, state: {} });
        }
    };

    const today = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    }, []);

    const currentGroup = useMemo(() => {
        if (selectedGroupId === 'all') return null;
        return groups.items.find(g => g._id === selectedGroupId) || null;
    }, [groups.items, selectedGroupId]);

    const cachedAnalysis = useMemo(() => {
        if (!selectedGroupId || selectedGroupId === 'all') {
            const firstGroup = groups.items[0];
            return firstGroup ? riskAnalysis?.[firstGroup._id] : null;
        }
        return riskAnalysis?.[selectedGroupId] || null;
    }, [riskAnalysis, selectedGroupId, groups.items]);

    // Aggregate statistics
    const stats = useMemo(() => {
        if (!groups.items.length) return null;

        if (currentGroup) {
            const rawTasks = currentGroup.tasks || [];
            const members = currentGroup.members || [];
            const timedTasks = rawTasks.length > 0
                ? calculateTimings(rawTasks, currentGroup.createdAt)
                : [];
            const projectPert = rawTasks.length > 0
                ? calculateProjectPert(rawTasks)
                : { expected: 0, standardDeviation: 0, variance: 0 };

            const completedTasks = rawTasks.filter(t => !t.status);
            const activeTasks = rawTasks.filter(t => t.status);
            const totalTasks = rawTasks.length;
            const progressPercent = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

            const overdueTasks = [];
            const dueSoonTasks = [];
            let unassignedActive = 0;
            let unassignedCompleted = 0;

            const riskCounts = { low: 0, medium: 0, high: 0, overdue: 0 };
            const actionItems = [];

            rawTasks.forEach(task => {
                const isOverdue = task.status && task.deadline && new Date(task.deadline).setHours(0, 0, 0, 0) < today.getTime();
                let isDueSoon = false;

                if (task.status && task.deadline) {
                    const dl = new Date(task.deadline).setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((dl - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (diffDays >= 0 && diffDays <= 3) {
                        isDueSoon = true;
                        dueSoonTasks.push(task);
                    }
                }

                if (!task.assignedTo) {
                    if (task.status) unassignedActive += 1;
                    else unassignedCompleted += 1;
                }

                if (isOverdue) {
                    overdueTasks.push(task);
                    riskCounts.overdue += 1;
                    actionItems.push({
                        ...task,
                        severity: 'overdue',
                        tagLabel: 'Прострочено',
                        riskReason: 'Термін виконання вичерпано',
                    });
                } else if (task.status) {
                    const risk = calculateDeadlineRisk(task, today);
                    if (risk.riskLevel === 'high') {
                        riskCounts.high += 1;
                        actionItems.push({
                            ...task,
                            severity: 'high',
                            tagLabel: 'Високий ризик',
                            riskReason: risk.riskReason || 'Бракує часу до дедлайну',
                        });
                    } else if (risk.riskLevel === 'medium') {
                        riskCounts.medium += 1;
                        if (isDueSoon) {
                            actionItems.push({
                                ...task,
                                severity: 'medium',
                                tagLabel: 'Дедлайн близько',
                                riskReason: 'Залишилось менше 3 днів',
                            });
                        }
                    } else {
                        riskCounts.low += 1;
                    }
                }
            });

            // Workload distribution by member
            const memberWorkload = members.map(m => {
                const mid = extractId(m._id);
                const assigned = rawTasks.filter(t => extractId(t.assignedTo) === mid);
                return {
                    id: mid,
                    name: m.fullName || m.email || 'Користувач',
                    completed: assigned.filter(t => !t.status).length,
                    active: assigned.filter(t => t.status).length,
                    total: assigned.length,
                };
            });

            if (unassignedActive > 0 || unassignedCompleted > 0) {
                memberWorkload.push({
                    id: 'unassigned',
                    name: 'Не призначено',
                    completed: unassignedCompleted,
                    active: unassignedActive,
                    total: unassignedActive + unassignedCompleted,
                });
            }

            // Duration distribution
            const durationMap = new Map();
            rawTasks.forEach(t => {
                const d = getTaskExpectedDuration(t);
                durationMap.set(d, (durationMap.get(d) || 0) + 1);
            });
            const taskDurations = Array.from(durationMap.entries())
                .map(([duration, count]) => ({ duration, count }))
                .sort((a, b) => a.duration - b.duration);

            // CPM Critical path
            const criticalPathTasks = timedTasks.filter(t => t.slack === 0 && t.status);
            const bufferTasks = timedTasks.filter(t => t.slack > 0 && t.status);
            const withDependencies = rawTasks.filter(t => Array.isArray(t.dependencies) && t.dependencies.length > 0).length;
            const withoutDependencies = totalTasks - withDependencies;

            return {
                isGroup: true,
                title: currentGroup.title,
                totalTasks,
                completedCount: completedTasks.length,
                activeCount: activeTasks.length,
                progressPercent,
                overdueCount: overdueTasks.length,
                dueSoonCount: dueSoonTasks.length,
                projectPert,
                criticalPathCount: criticalPathTasks.length,
                bufferCount: bufferTasks.length,
                withDependencies,
                withoutDependencies,
                riskCounts,
                memberWorkload,
                taskDurations,
                actionItems,
                membersCount: members.length,
                unassignedCount: unassignedActive,
            };
        } else {
            // General statistics across all projects
            let totalTasks = 0;
            let completedCount = 0;
            let activeCount = 0;
            let overdueCount = 0;
            let dueSoonCount = 0;
            let unassignedCount = 0;
            let withDependencies = 0;
            let withoutDependencies = 0;
            const actionItems = [];

            const projectStats = [];
            const durationMap = new Map();
            const uniqueMemberIds = new Set();

            groups.items.forEach(group => {
                const groupTasks = group.tasks || [];
                let groupCompleted = 0;
                let groupActive = 0;
                let groupOverdue = 0;
                let groupPriority = 0;

                (group.members || []).forEach(m => uniqueMemberIds.add(extractId(m._id)));

                groupTasks.forEach(task => {
                    totalTasks += 1;
                    if (!task.status) {
                        completedCount += 1;
                        groupCompleted += 1;
                    } else {
                        activeCount += 1;
                        groupActive += 1;
                    }

                    if (task.priority) groupPriority += 1;

                    if (!task.assignedTo && task.status) unassignedCount += 1;

                    const isOverdue = task.status && task.deadline && new Date(task.deadline).setHours(0, 0, 0, 0) < today.getTime();
                    if (isOverdue) {
                        overdueCount += 1;
                        groupOverdue += 1;
                        actionItems.push({
                            ...task,
                            projectTitle: group.title,
                            severity: 'overdue',
                            tagLabel: 'Прострочено',
                            riskReason: 'Термін виконання вичерпано',
                        });
                    } else if (task.status && task.deadline) {
                        const dl = new Date(task.deadline).setHours(0, 0, 0, 0);
                        const diffDays = Math.ceil((dl - today.getTime()) / (1000 * 60 * 60 * 24));
                        if (diffDays >= 0 && diffDays <= 3) {
                            dueSoonCount += 1;
                        }
                    }

                    if (task.dependencies && task.dependencies.length > 0) withDependencies += 1;
                    else withoutDependencies += 1;

                    const d = getTaskExpectedDuration(task);
                    durationMap.set(d, (durationMap.get(d) || 0) + 1);
                });

                projectStats.push({
                    title: group.title,
                    total: groupTasks.length,
                    completed: groupCompleted,
                    active: groupActive,
                    overdue: groupOverdue,
                    priority: groupPriority,
                });
            });

            const taskDurations = Array.from(durationMap.entries())
                .map(([duration, count]) => ({ duration, count }))
                .sort((a, b) => a.duration - b.duration);

            const progressPercent = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

            return {
                isGroup: false,
                title: 'Загальна статистика',
                totalTasks,
                completedCount,
                activeCount,
                progressPercent,
                overdueCount,
                dueSoonCount,
                totalProjects: groups.items.length,
                membersCount: uniqueMemberIds.size,
                unassignedCount,
                withDependencies,
                withoutDependencies,
                projectStats,
                taskDurations,
                actionItems: actionItems.slice(0, 8),
            };
        }
    }, [groups.items, currentGroup, today]);

    if (!isAuth) {
        return <Navigate to="/login" />;
    }

    if (isGroupsLoading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingContainer}>
                    <div className={styles.stateTitle}>Завантаження аналітики...</div>
                    <div className={styles.stateText}>Отримуємо найсвіжіші метрики проєктів...</div>
                </div>
            </div>
        );
    }

    if (!groups.items.length) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <Link to="/" className={styles.backBtn}>
                        <MyButton><FaArrowLeft /> На головну</MyButton>
                    </Link>
                </div>
                <div className={styles.emptyContainer}>
                    <h2 className={styles.stateTitle}>Немає проєктів для відображення статистики</h2>
                    <p className={styles.stateText}>Створіть свій перший проєкт або додайте завдання для побудови аналітики.</p>
                    <Link to="/">
                        <MyButton>Створити проєкт</MyButton>
                    </Link>
                </div>
            </div>
        );
    }

    // Chart Data Configs
    const statusChartData = {
        labels: ['Виконані', 'В процесі', ...(stats?.overdueCount > 0 ? ['Прострочені'] : [])],
        datasets: [
            {
                data: [
                    stats?.completedCount || 0,
                    Math.max(0, (stats?.activeCount || 0) - (stats?.overdueCount || 0)),
                    ...(stats?.overdueCount > 0 ? [stats.overdueCount] : []),
                ],
                backgroundColor: ['#10B981', '#3B82F6', '#EF4444'],
                borderColor: ['#059669', '#2563EB', '#DC2626'],
                borderWidth: 2,
            },
        ],
    };

    const statusChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 14, font: { size: 12, weight: '500' } },
            },
        },
        cutout: '68%',
    };

    // Risk chart (Group only)
    const riskChartData = stats?.isGroup ? {
        labels: ['Низький', 'Помірний', 'Високий', 'Прострочено'],
        datasets: [
            {
                label: 'Кількість задач',
                data: [
                    stats.riskCounts?.low || 0,
                    stats.riskCounts?.medium || 0,
                    stats.riskCounts?.high || 0,
                    stats.riskCounts?.overdue || 0,
                ],
                backgroundColor: ['#10B981', '#F59E0B', '#F97316', '#EF4444'],
                borderRadius: 6,
            },
        ],
    } : null;

    const riskChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } },
        },
    };

    // Workload Chart (Group only)
    const workloadChartData = stats?.isGroup ? {
        labels: stats.memberWorkload?.map(m => m.name) || [],
        datasets: [
            {
                label: 'Виконано',
                data: stats.memberWorkload?.map(m => m.completed) || [],
                backgroundColor: '#10B981',
                borderRadius: 4,
            },
            {
                label: 'В процесі',
                data: stats.memberWorkload?.map(m => m.active) || [],
                backgroundColor: '#3B82F6',
                borderRadius: 4,
            },
        ],
    } : null;

    const workloadChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 12, font: { size: 12, weight: '500' } },
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } },
        },
    };

    // Project breakdown Chart (General only)
    const projectsChartData = !stats?.isGroup ? {
        labels: stats?.projectStats?.map(p => p.title) || [],
        datasets: [
            {
                label: 'Виконано',
                data: stats?.projectStats?.map(p => p.completed) || [],
                backgroundColor: '#10B981',
                borderRadius: 4,
            },
            {
                label: 'В процесі',
                data: stats?.projectStats?.map(p => p.active) || [],
                backgroundColor: '#3B82F6',
                borderRadius: 4,
            },
        ],
    } : null;

    const projectsChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { boxWidth: 12, padding: 12, font: { size: 12, weight: '500' } },
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false } },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } },
        },
    };

    // Dependency Chart
    const dependencyChartData = {
        labels: ['З залежностями', 'Без залежностей'],
        datasets: [
            {
                data: [stats?.withDependencies || 0, stats?.withoutDependencies || 0],
                backgroundColor: ['#8B5CF6', '#CBD5E1'],
                borderColor: ['#7C3AED', '#94A3B8'],
                borderWidth: 2,
            },
        ],
    };

    // Duration Distribution Chart
    const durationChartData = {
        labels: stats?.taskDurations?.map(d => `${d.duration} дн.`) || [],
        datasets: [
            {
                label: 'Задач',
                data: stats?.taskDurations?.map(d => d.count) || [],
                backgroundColor: '#6366F1',
                borderRadius: 6,
            },
        ],
    };

    const durationChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { title: { display: true, text: 'Тривалість (дні)', font: { size: 12 } }, grid: { display: false } },
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: '#F1F5F9' } },
        },
    };

    const activeGroupIdForAi = selectedGroupId !== 'all'
        ? selectedGroupId
        : (groups.items[0]?._id || '');

    const activeGroupTitleForAi = selectedGroupId !== 'all'
        ? (currentGroup?.title || 'Проєкт')
        : (groups.items[0]?.title || 'Проєкт');

    return (
        <div className={styles.container}>
            {/* Header with back button, page title and controls */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    <MyButton
                        className={styles.backBtn}
                        onClick={() => navigate('/')}
                    >
                        <FaArrowLeft /> Назад
                    </MyButton>
                    <h1 className={styles.title}>
                        {stats?.isGroup ? `Статистика: ${stats.title}` : 'Аналітика та статистика'}
                    </h1>
                </div>

                <div className={styles.controlsBar}>
                    <div className={styles.filterGroup}>
                        <label htmlFor="stats-project-select" className={styles.filterLabel}>Проєкт:</label>
                        <select
                            id="stats-project-select"
                            className={styles.projectSelect}
                            value={selectedGroupId}
                            onChange={(e) => handleSelectGroup(e.target.value)}
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
                                className={styles.resetFilterBtn}
                                onClick={() => handleSelectGroup('all')}
                                title="Показати загальну статистику"
                            >
                                Усі проєкти
                            </button>
                        )}
                    </div>

                    <MyButton
                        className={styles.aiButton}
                        onClick={() => {
                            if (selectedGroupId === 'all' && groups.items.length > 0) {
                                handleSelectGroup(groups.items[0]._id);
                            }
                            setAiModalVisible(true);
                        }}
                        title="AI-аналіз стану проєкту, ризиків та практичних порад"
                    >
                        <FaRobot />
                        <span>AI-резюме проєкту</span>
                    </MyButton>
                </div>
            </div>

            {/* AI Summary Banner (if analysis was previously cached) */}
            {cachedAnalysis && (
                <div className={styles.aiTeaser}>
                    <div className={styles.aiTeaserContent}>
                        <FaRobot className={styles.aiTeaserIcon} />
                        <div className={styles.aiTeaserText}>
                            <strong>
                                AI-оцінка стану ({cachedAnalysis.riskLevel === 'CRITICAL'
                                    ? '🔴 Критичний'
                                    : cachedAnalysis.riskLevel === 'HIGH'
                                        ? '🔴 Високий'
                                        : cachedAnalysis.riskLevel === 'MEDIUM'
                                            ? '🟡 Помірний'
                                            : '🟢 Низький'}):
                            </strong> {cachedAnalysis.summary}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.aiTeaserAction}
                        onClick={() => setAiModalVisible(true)}
                    >
                        Повний AI-звіт
                    </button>
                </div>
            )}

            {/* Top Hero KPI Cards */}
            <div className={styles.kpiGrid}>
                {/* 1. Progress */}
                <div className={styles.kpiCard}>
                    <div className={styles.kpiCardTop}>
                        <span className={styles.kpiLabel}>Прогрес виконання</span>
                        <div className={`${styles.kpiIconWrapper} ${styles.iconGreen}`}>
                            <FaCheckCircle />
                        </div>
                    </div>
                    <div>
                        <div className={`${styles.kpiValue} ${styles.kpiValueGreen}`}>{stats?.progressPercent}%</div>
                        <div className={styles.progressBarWrapper}>
                            <div className={styles.progressBarFill} style={{ width: `${stats?.progressPercent}%` }} />
                        </div>
                        <div className={styles.kpiSubtitle}>{stats?.completedCount} з {stats?.totalTasks} задач виконано</div>
                    </div>
                </div>

                {/* 2. Forecast PERT / Project Count */}
                <div className={styles.kpiCard}>
                    <div className={styles.kpiCardTop}>
                        <span className={styles.kpiLabel}>
                            {stats?.isGroup ? 'Прогноз терміну (PERT)' : 'Активні проєкти'}
                        </span>
                        <div className={`${styles.kpiIconWrapper} ${styles.iconBlue}`}>
                            {stats?.isGroup ? <FaClock /> : <FaFolderOpen />}
                        </div>
                    </div>
                    <div>
                        <div className={styles.kpiValue}>
                            {stats?.isGroup
                                ? `${stats.projectPert?.expected ? stats.projectPert.expected.toFixed(1) : 0} дн.`
                                : `${stats?.totalProjects || 0}`}
                        </div>
                        <div className={styles.kpiSubtitle}>
                            {stats?.isGroup
                                ? `± ${stats.projectPert?.standardDeviation ? stats.projectPert.standardDeviation.toFixed(1) : 0} дн. (критичний шлях)`
                                : `${stats?.totalTasks || 0} задач сумарно`}
                        </div>
                    </div>
                </div>

                {/* 3. Deadlines & Overdue */}
                <div className={styles.kpiCard}>
                    <div className={styles.kpiCardTop}>
                        <span className={styles.kpiLabel}>Статус дедлайнів</span>
                        <div className={`${styles.kpiIconWrapper} ${stats?.overdueCount > 0 ? styles.iconRed : styles.iconGreen}`}>
                            <FaExclamationTriangle />
                        </div>
                    </div>
                    <div>
                        <div className={`${styles.kpiValue} ${stats?.overdueCount > 0 ? styles.kpiValueRed : ''}`}>
                            {stats?.overdueCount > 0 ? `${stats.overdueCount} прострочено` : 'Всі вчасно'}
                        </div>
                        <div className={styles.kpiSubtitle}>
                            {stats?.dueSoonCount > 0
                                ? `${stats.dueSoonCount} дедлайнів у найближчі 3 дні`
                                : 'Немає термінових дедлайнів'}
                        </div>
                    </div>
                </div>

                {/* 4. Risk / Critical Path */}
                <div className={styles.kpiCard}>
                    <div className={styles.kpiCardTop}>
                        <span className={styles.kpiLabel}>
                            {stats?.isGroup ? 'Критичний шлях' : 'Розподіл залежностей'}
                        </span>
                        <div className={`${styles.kpiIconWrapper} ${styles.iconPurple}`}>
                            <FaProjectDiagram />
                        </div>
                    </div>
                    <div>
                        <div className={styles.kpiValue}>
                            {stats?.isGroup
                                ? `${stats.criticalPathCount} задач`
                                : `${stats?.withDependencies} з залежностями`}
                        </div>
                        <div className={styles.kpiSubtitle}>
                            {stats?.isGroup
                                ? `${stats.bufferCount} задач мають часовий резерв`
                                : `${stats?.withoutDependencies} автономних задач`}
                        </div>
                    </div>
                </div>

                {/* 5. Team Workload */}
                <div className={styles.kpiCard}>
                    <div className={styles.kpiCardTop}>
                        <span className={styles.kpiLabel}>Команда проєкту</span>
                        <div className={`${styles.kpiIconWrapper} ${styles.iconAmber}`}>
                            <FaUsers />
                        </div>
                    </div>
                    <div>
                        <div className={styles.kpiValue}>
                            {stats?.membersCount} {stats?.membersCount === 1 ? 'учасник' : 'учасників'}
                        </div>
                        <div className={styles.kpiSubtitle}>
                            {stats?.unassignedCount > 0
                                ? `${stats.unassignedCount} задач не призначено`
                                : 'Усі активні задачі розподілено'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
                {/* Chart 1: Status (Doughnut) */}
                <div className={styles.chartCard}>
                    <div className={styles.chartCardHeader}>
                        <FaTasks className={styles.chartCardIcon} />
                        <h3 className={styles.chartCardTitle}>Статус завдань</h3>
                    </div>
                    <div className={styles.chartBody}>
                        <Doughnut data={statusChartData} options={statusChartOptions} />
                    </div>
                </div>

                {/* Chart 2: Risks (Group only) OR Projects Overview (General only) */}
                {stats?.isGroup ? (
                    <div className={styles.chartCard}>
                        <div className={styles.chartCardHeader}>
                            <FaShieldAlt className={styles.chartCardIcon} />
                            <h3 className={styles.chartCardTitle}>Розподіл ризиків запізнення (PERT)</h3>
                        </div>
                        <div className={styles.chartBody}>
                            <Bar data={riskChartData} options={riskChartOptions} />
                        </div>
                    </div>
                ) : (
                    <div className={styles.chartCard}>
                        <div className={styles.chartCardHeader}>
                            <FaChartBar className={styles.chartCardIcon} />
                            <h3 className={styles.chartCardTitle}>Виконання за проєктами</h3>
                        </div>
                        <div className={styles.chartBody}>
                            <Bar data={projectsChartData} options={projectsChartOptions} />
                        </div>
                    </div>
                )}

                {/* Chart 3: Workload (Group only) OR Dependencies (General) */}
                {stats?.isGroup && (
                    <div className={styles.chartCard}>
                        <div className={styles.chartCardHeader}>
                            <FaUsers className={styles.chartCardIcon} />
                            <h3 className={styles.chartCardTitle}>Навантаження на команду</h3>
                        </div>
                        <div className={styles.chartBody}>
                            <Bar data={workloadChartData} options={workloadChartOptions} />
                        </div>
                    </div>
                )}

                {/* Chart 4: Dependencies */}
                <div className={styles.chartCard}>
                    <div className={styles.chartCardHeader}>
                        <FaProjectDiagram className={styles.chartCardIcon} />
                        <h3 className={styles.chartCardTitle}>Структура залежностей</h3>
                    </div>
                    <div className={styles.chartBody}>
                        <Doughnut data={dependencyChartData} options={statusChartOptions} />
                    </div>
                </div>

                {/* Chart 5: Duration Distribution */}
                <div className={styles.chartCard}>
                    <div className={styles.chartCardHeader}>
                        <FaClock className={styles.chartCardIcon} />
                        <h3 className={styles.chartCardTitle}>Розподіл тривалості задач</h3>
                    </div>
                    <div className={styles.chartBody}>
                        <Bar data={durationChartData} options={durationChartOptions} />
                    </div>
                </div>
            </div>

            {/* Action Items / High Risk Tasks Section */}
            <div className={styles.attentionSection}>
                <div className={styles.attentionHeader}>
                    <div className={styles.attentionHeaderLeft}>
                        <FaExclamationTriangle style={{ color: '#EA580C', fontSize: '20px' }} />
                        <h3 className={styles.attentionTitle}>Задачі, що потребують уваги</h3>
                        {stats?.actionItems?.length > 0 && (
                            <span className={styles.attentionBadge}>
                                {stats.actionItems.length} {stats.actionItems.length === 1 ? 'задача' : 'задач'}
                            </span>
                        )}
                    </div>
                </div>

                {stats?.actionItems?.length > 0 ? (
                    <div className={styles.attentionList}>
                        {stats.actionItems.map((task) => {
                            const isOverdue = task.severity === 'overdue';
                            const isHigh = task.severity === 'high';
                            const deadlineDateStr = task.deadline
                                ? new Date(task.deadline).toLocaleDateString('uk-UA')
                                : 'Без дедлайну';

                            return (
                                <div
                                    key={task._id}
                                    className={`${styles.attentionItem} ${isOverdue ? styles.attentionItemOverdue : ''}`}
                                >
                                    <div className={styles.attentionItemTop}>
                                        <h4 className={styles.attentionTaskTitle}>{task.title}</h4>
                                        <span className={`${styles.riskTag} ${isOverdue ? styles.tagOverdue : (isHigh ? styles.tagHigh : styles.tagMedium)}`}>
                                            {task.tagLabel}
                                        </span>
                                    </div>
                                    <div className={styles.attentionTaskMeta}>
                                        <div className={styles.attentionMetaItem}>
                                            <FaCalendarAlt />
                                            <span>{deadlineDateStr}</span>
                                        </div>
                                        <div className={styles.attentionMetaItem}>
                                            <FaClock />
                                            <span>~{getTaskExpectedDuration(task)} дн.</span>
                                        </div>
                                        <div className={styles.attentionMetaItem}>
                                            <span>{task.riskReason}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={styles.emptyAttentionState}>
                        <FaCheckCircle style={{ fontSize: '20px' }} />
                        <span>Усі задачі рухаються за планом, критичних запізнень та високих ризиків не виявлено!</span>
                    </div>
                )}
            </div>

            {/* AI Risk Analysis Modal */}
            <AiRiskModal
                visible={aiModalVisible}
                setVisible={setAiModalVisible}
                groupId={activeGroupIdForAi}
                groupTitle={activeGroupTitleForAi}
            />
        </div>
    );
};

export default TaskStatistics;