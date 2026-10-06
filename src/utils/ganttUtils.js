const getDaysDifference = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffInMs = d1 - d2;
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
};

export const GANTT_TASK_ROW_HEIGHT = 64;

export const getTaskExpectedDuration = (task) =>
    Math.max(1, Number(task.pert?.expected) || Number(task.duration) || 1);

export const calculateProjectPert = (tasks) => {
    const taskMap = new Map(tasks.map(task => [String(task._id), task]));
    const remainingDependencies = new Map();
    const dependentTasks = new Map();
    const readyTasks = [];
    const finishTimes = new Map();
    const pathVariances = new Map();
    const lastTaskByResource = new Map();

    tasks.forEach(task => {
        const taskId = String(task._id);
        const dependencies = (task.dependencies || [])
            .map(dependencyId => String(dependencyId))
            .filter(dependencyId => taskMap.has(dependencyId));
        remainingDependencies.set(taskId, dependencies.length);

        dependencies.forEach(dependencyId => {
            const dependents = dependentTasks.get(dependencyId) || [];
            dependentTasks.set(dependencyId, [...dependents, taskId]);
        });

        if (dependencies.length === 0) readyTasks.push(taskId);
    });

    const getTaskEstimate = (task) => ({
        expected: Number(task.pert?.expected) || Math.max(1, Number(task.duration) || 1),
        variance: Number(task.pert?.variance) || 0,
    });

    let processedTasks = 0;
    while (readyTasks.length > 0) {
        readyTasks.sort((firstId, secondId) => {
            const firstTask = taskMap.get(firstId);
            const secondTask = taskMap.get(secondId);
            return new Date(firstTask.createdAt || 0) - new Date(secondTask.createdAt || 0);
        });

        const taskId = readyTasks.shift();
        const task = taskMap.get(taskId);
        const resourceId = task.assignedTo ? String(task.assignedTo) : '__unassigned__';
        const blockers = [];

        (task.dependencies || []).forEach(dependencyId => {
            const dependencyIdString = String(dependencyId);
            if (finishTimes.has(dependencyIdString)) {
                blockers.push({
                    finish: finishTimes.get(dependencyIdString),
                    variance: pathVariances.get(dependencyIdString) || 0,
                });
            }
        });

        const previousTaskId = lastTaskByResource.get(resourceId);
        if (previousTaskId) {
            blockers.push({
                finish: finishTimes.get(previousTaskId) || 0,
                variance: pathVariances.get(previousTaskId) || 0,
            });
        }

        const longestBlocker = blockers.reduce(
            (longest, blocker) => blocker.finish > longest.finish ? blocker : longest,
            { finish: 0, variance: 0 }
        );
        const estimate = getTaskEstimate(task);
        finishTimes.set(taskId, longestBlocker.finish + estimate.expected);
        pathVariances.set(taskId, longestBlocker.variance + estimate.variance);
        lastTaskByResource.set(resourceId, taskId);
        processedTasks += 1;

        (dependentTasks.get(taskId) || []).forEach(dependentId => {
            const dependenciesLeft = remainingDependencies.get(dependentId) - 1;
            remainingDependencies.set(dependentId, dependenciesLeft);
            if (dependenciesLeft === 0) readyTasks.push(dependentId);
        });
    }

    if (processedTasks < tasks.length) {
        return tasks.reduce((result, task) => {
            const estimate = getTaskEstimate(task);
            return {
                expected: result.expected + estimate.expected,
                variance: result.variance + estimate.variance,
            };
        }, { expected: 0, variance: 0 });
    }

    const projectTaskId = [...finishTimes.entries()].reduce(
        (longest, [taskId, finish]) => finish > longest.finish ? { taskId, finish } : longest,
        { taskId: null, finish: 0 }
    ).taskId;
    const projectPath = {
        expected: finishTimes.get(projectTaskId) || 0,
        variance: pathVariances.get(projectTaskId) || 0,
    };

    return {
        expected: projectPath.expected,
        standardDeviation: Math.sqrt(projectPath.variance),
    };
};

export const calculateTimings = (tasks, groupCreatedAt) => {
    try {
        const validTasks = tasks.map(task => {
            const validDependencies = (task.dependencies || []).filter(depId =>
                tasks.some(t => t._id === depId)
            );
            return { ...task, dependencies: validDependencies };
        });

        const nodes = validTasks.map(task => ({
            ...task,
            earliestStart: 0,
            earliestFinish: 0,
            latestStart: 0,
            latestFinish: 0,
            slack: 0,
            deadlineMissed: false,
        }));

        const taskMap = new Map(nodes.map(node => [node._id, node]));
        const startNodes = nodes.filter(node => !node.dependencies || node.dependencies.length === 0);

        const queue = [...startNodes];
        const visited = new Set();

        while (queue.length > 0) {
            const current = queue.shift();
            if (visited.has(current._id)) continue;
            visited.add(current._id);

            const createdAt = new Date(groupCreatedAt);
            const taskCreatedAt = new Date(current.createdAt || groupCreatedAt);
            const daysSinceGroupCreation = getDaysDifference(taskCreatedAt, createdAt);
            const minEarliestStart = Math.max(0, daysSinceGroupCreation);

            if (current.dependencies && current.dependencies.length > 0) {
                const maxDependencyFinish = Math.max(
                    ...current.dependencies.map(depId => taskMap.get(depId).earliestFinish)
                );
                current.earliestStart = Math.max(maxDependencyFinish, minEarliestStart);
            } else {
                current.earliestStart = minEarliestStart;
            }

            current.earliestFinish = current.earliestStart + getTaskExpectedDuration(current);

            nodes.forEach(node => {
                if (node.dependencies && node.dependencies.includes(current._id)) {
                    queue.push(node);
                }
            });
        }

        const maxEarliestFinish = Math.max(...nodes.map(node => node.earliestFinish || 0));

        const endNodes = nodes.filter(node => 
            !nodes.some(n => n.dependencies && n.dependencies.includes(node._id))
        );

        const reverseQueue = [...endNodes];
        const reverseVisited = new Set();

        while (reverseQueue.length > 0) {
            const current = reverseQueue.shift();
            if (reverseVisited.has(current._id)) continue;
            reverseVisited.add(current._id);

            if (!nodes.some(node => node.dependencies && node.dependencies.includes(current._id))) {
                if (current.deadline) {
                    const deadlineDate = new Date(current.deadline);
                    const createdAt = new Date(groupCreatedAt);
                    const deadlineDays = getDaysDifference(deadlineDate, createdAt);
                    current.latestFinish = deadlineDays;
                } else {
                    current.latestFinish = maxEarliestFinish;
                }
            } else {
                const minDependentStart = Math.min(
                    ...nodes
                        .filter(node => node.dependencies && node.dependencies.includes(current._id))
                        .map(node => node.latestStart)
                );
                if (current.deadline) {
                    const deadlineDate = new Date(current.deadline);
                    const createdAt = new Date(groupCreatedAt);
                    const deadlineDays = getDaysDifference(deadlineDate, createdAt);
                    current.latestFinish = Math.min(minDependentStart, deadlineDays);
                } else {
                    current.latestFinish = minDependentStart;
                }
            }

            current.latestFinish = Math.max(current.latestFinish, current.earliestFinish);
            current.latestStart = current.latestFinish - getTaskExpectedDuration(current);
            current.latestStart = Math.max(current.latestStart, current.earliestStart);
            current.slack = current.latestStart - current.earliestStart;

            if (current.deadline) {
                const deadlineDate = new Date(current.deadline);
                const createdAt = new Date(groupCreatedAt);
                const deadlineDays = getDaysDifference(deadlineDate, createdAt);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                deadlineDate.setHours(0, 0, 0, 0);
                current.deadlineMissed = (deadlineDate < today) || (current.earliestFinish > deadlineDays);
            }

            if (current.dependencies && current.dependencies.length > 0) {
                current.dependencies.forEach(depId => {
                    const dep = taskMap.get(depId);
                    if (dep) reverseQueue.push(dep);
                });
            }
        }

        const createdAt = new Date(groupCreatedAt);
        nodes.forEach(node => {
            node.earliestStartDate = new Date(createdAt);
            node.earliestStartDate.setDate(createdAt.getDate() + node.earliestStart);
            node.earliestFinishDate = new Date(createdAt);
            node.earliestFinishDate.setDate(createdAt.getDate() + node.earliestFinish);
            node.latestStartDate = new Date(createdAt);
            node.latestStartDate.setDate(createdAt.getDate() + node.latestStart);
            node.latestFinishDate = new Date(createdAt);
            node.latestFinishDate.setDate(createdAt.getDate() + node.latestFinish);
        });

        return nodes;
    } catch (error) {
        console.error('Error in calculateTimings:', error);
        return tasks.map(task => ({
            ...task,
            earliestStart: 0,
            earliestFinish: getTaskExpectedDuration(task),
            latestStart: 0,
            latestFinish: getTaskExpectedDuration(task),
            earliestStartDate: new Date(groupCreatedAt),
            earliestFinishDate: new Date(groupCreatedAt),
            latestStartDate: new Date(groupCreatedAt),
            latestFinishDate: new Date(groupCreatedAt),
            slack: 0,
            deadlineMissed: false,
        }));
    }
};

export const sortTasksWithDependencies = (tasks) => {
    const sortedTasks = [];
    const visited = new Set();
    const taskMap = new Map(tasks.map(task => [task._id, task]));

    const visit = (taskId) => {
        if (visited.has(taskId)) return;
        visited.add(taskId);

        const task = taskMap.get(taskId);
        if (task && task.dependencies) {
            task.dependencies.forEach(depId => visit(depId));
        }
        if (task) sortedTasks.push(task);
    };

    tasks.forEach(task => {
        if (!visited.has(task._id)) {
            visit(task._id);
        }
    });

    return sortedTasks;
};

export const calculateTaskLevel = (occupiedIntervals, startDay, endDay) => {
    let level = 0;
    for (let currentLevel = 0; ; currentLevel++) {
        const hasOverlap = occupiedIntervals.some(interval =>
            interval.level === currentLevel && !((interval.endDay <= startDay) || (endDay <= interval.startDay))
        );
        if (!hasOverlap) {
            level = currentLevel;
            break;
        }
    }
    return level;
};

export const optimizeSchedule = (tasks, members, groupCreatedAt) => {
    const adjustedTasks = calculateTimings(tasks, groupCreatedAt);
    const minStartDate = new Date(Math.min(...adjustedTasks.map(task => task.earliestStartDate)));
    const executors = [];

    let executorCount = 1;
    let allTasksAssigned = false;

    while (!allTasksAssigned) {
        executors.length = 0;
        for (let i = 0; i < executorCount; i++) {
            executors.push({ tasks: [], occupiedIntervals: [] });
        }

        allTasksAssigned = true;
        for (const task of adjustedTasks) {
            let assigned = false;
            for (const executor of executors) {
                const startDay = Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24));
                const taskDays = getTaskExpectedDuration(task);
                const endDay = startDay + taskDays;

                const hasOverlap = executor.occupiedIntervals.some(interval =>
                    !(interval.endDay <= startDay || endDay <= interval.startDay)
                );

                if (!hasOverlap) {
                    executor.tasks.push(task);
                    executor.occupiedIntervals.push({ startDay, endDay, level: 0 });
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                allTasksAssigned = false;
                break;
            }
        }

        if (!allTasksAssigned) {
            executorCount++;
        }
    }

    executors.forEach(executor => {
        executor.tasks.sort((a, b) => new Date(a.earliestStartDate) - new Date(b.earliestStartDate));
        const taskOffsets = new Map();
        executor.occupiedIntervals = [];

        executor.tasks.forEach((task, index) => {
            const startDay = Math.floor((new Date(task.earliestStartDate) - minStartDate) / (1000 * 60 * 60 * 24));
            const taskDays = getTaskExpectedDuration(task);
            const endDay = startDay + taskDays;

            const level = calculateTaskLevel(executor.occupiedIntervals, startDay, endDay);

            taskOffsets.set(task._id, level * GANTT_TASK_ROW_HEIGHT);
            executor.occupiedIntervals.push({ startDay, endDay, level });
        });

        const maxLevel = Math.max(...Array.from(taskOffsets.values()).map(offset => offset / GANTT_TASK_ROW_HEIGHT), 0);
        executor.tasks = executor.tasks.map(task => ({
            ...task,
            offsetY: taskOffsets.get(task._id) || 0,
        }));
        executor.maxLevel = maxLevel;
    });

    return executors;
};

export const calculateDeadlineRisk = (task, today = new Date()) => {
    if (!task.deadline) {
        return {
            riskScore: 0,
            riskLevel: 'low',
            riskReason: 'Дедлайн не задано',
        };
    }

    if (!task.status) {
        return {
            riskScore: 0,
            riskLevel: 'low',
            riskReason: 'Задачу виконано',
        };
    }

    const deadline = new Date(task.deadline);
    const daysRemaining = getDaysDifference(deadline, today);
    const duration = Math.max(1, Number(task.duration) || 1);
    const expectedDuration = Math.max(1, Number(task.pert?.expected) || duration);
    const standardDeviation = Math.max(0, Number(task.pert?.standardDeviation) || 0);
    const plannedStart = task.earliestStartDate ? new Date(task.earliestStartDate) : new Date(today);
    const plannedFinish = new Date(plannedStart);
    plannedFinish.setTime(plannedStart.getTime() + expectedDuration * 24 * 60 * 60 * 1000);
    const daysAvailableForTask = getDaysDifference(deadline, plannedStart);
    const plannedFinishAfterDeadline = plannedFinish.getTime() > deadline.getTime();
    const dependencyPenalty = Math.min(15, (task.dependencies || []).length * 5);

    let riskScore;
    let riskReason;
    if (daysRemaining < 0 || daysAvailableForTask < 0 || plannedFinishAfterDeadline) {
        riskScore = 100;
        riskReason = 'PERT-прогноз завершення перевищує дедлайн';
    } else if (daysAvailableForTask <= expectedDuration + standardDeviation) {
        riskScore = 70;
        riskReason = 'Дедлайн потрапляє в зону невизначеності PERT';
    } else if (daysAvailableForTask <= expectedDuration * 1.5) {
        riskScore = 45;
        riskReason = 'Невеликий запас часу за PERT-прогнозом';
    } else {
        riskScore = 15;
        riskReason = 'Достатній запас часу за PERT-прогнозом';
    }

    riskScore = Math.min(100, riskScore + dependencyPenalty);

    return {
        riskScore,
        riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
        riskReason: dependencyPenalty
            ? `${riskReason}; ${task.dependencies.length} залежностей`
            : riskReason,
    };
};