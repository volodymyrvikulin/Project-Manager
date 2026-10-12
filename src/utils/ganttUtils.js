const getDaysDifference = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    d1.setHours(0, 0, 0, 0);
    d2.setHours(0, 0, 0, 0);
    const diffInMs = d1 - d2;
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
};

export const GANTT_TASK_ROW_HEIGHT = 64;

export const extractId = (val) => {
    if (!val) return '';
    if (typeof val === 'object') {
        return val._id ? String(val._id) : (val.userId ? String(val.userId) : String(val));
    }
    return String(val);
};

export const getTaskExpectedDuration = (task) => {
    if (task.pert && Number(task.pert.standardDeviation) > 0 && Number(task.pert.expected) > 0) {
        return Math.max(1, Math.round(Number(task.pert.expected)));
    }
    return Math.max(1, Math.round(Number(task.duration) || Number(task.pert?.expected) || 1));
};

export const calculateProjectPert = (tasks) => {
    const taskMap = new Map(tasks.map(task => [extractId(task._id), task]));
    const remainingDependencies = new Map();
    const dependentTasks = new Map();
    const readyTasks = [];
    const finishTimes = new Map();
    const pathVariances = new Map();
    const lastTaskByResource = new Map();

    tasks.forEach(task => {
        const taskId = extractId(task._id);
        const dependencies = (task.dependencies || [])
            .map(extractId)
            .filter(dependencyId => dependencyId && taskMap.has(dependencyId));
        remainingDependencies.set(taskId, dependencies.length);

        dependencies.forEach(dependencyId => {
            const dependents = dependentTasks.get(dependencyId) || [];
            dependentTasks.set(dependencyId, [...dependents, taskId]);
        });

        if (dependencies.length === 0) readyTasks.push(taskId);
    });

    const getTaskEstimate = (task) => {
        const hasPertRisk = task.pert && Number(task.pert.standardDeviation) > 0 && Number(task.pert.expected) > 0;
        return {
            expected: hasPertRisk
                ? Number(task.pert.expected)
                : Math.max(1, Number(task.duration) || Number(task.pert?.expected) || 1),
            variance: hasPertRisk ? (Number(task.pert?.variance) || 0) : 0,
        };
    };

    let processedTasks = 0;
    while (readyTasks.length > 0) {
        readyTasks.sort((firstId, secondId) => {
            const firstTask = taskMap.get(firstId);
            const secondTask = taskMap.get(secondId);
            return new Date(firstTask?.createdAt || 0) - new Date(secondTask?.createdAt || 0);
        });

        const taskId = readyTasks.shift();
        const task = taskMap.get(taskId);
        if (!task) continue;
        const resourceId = task.assignedTo ? extractId(task.assignedTo) : '__unassigned__';
        const blockers = [];

        (task.dependencies || []).forEach(dependencyId => {
            const dependencyIdString = extractId(dependencyId);
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
        const fallback = tasks.reduce((result, task) => {
            const estimate = getTaskEstimate(task);
            return {
                expected: result.expected + estimate.expected,
                variance: result.variance + estimate.variance,
            };
        }, { expected: 0, variance: 0 });
        return {
            expected: fallback.expected,
            variance: fallback.variance,
            standardDeviation: Math.sqrt(fallback.variance),
        };
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
        variance: projectPath.variance,
        standardDeviation: Math.sqrt(projectPath.variance),
    };
};

export const calculateTimings = (tasks, groupCreatedAt) => {
    try {
        const validTasks = tasks.map(task => {
            const rawDeps = Array.isArray(task.dependencies) ? task.dependencies : [];
            const validDependencies = rawDeps
                .map(extractId)
                .filter(depId => depId && tasks.some(t => extractId(t._id) === depId));
            return {
                ...task,
                _id: extractId(task._id),
                dependencies: validDependencies,
            };
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

        const taskMap = new Map(nodes.map(node => [extractId(node._id), node]));
        const startNodes = nodes.filter(node => !node.dependencies || node.dependencies.length === 0);

        const queue = [...startNodes];
        const visited = new Set();

        while (queue.length > 0) {
            const current = queue.shift();
            const currentId = extractId(current._id);
            if (visited.has(currentId)) continue;
            visited.add(currentId);

            const createdAt = new Date(groupCreatedAt);
            const taskCreatedAt = new Date(current.createdAt || groupCreatedAt);
            const daysSinceGroupCreation = getDaysDifference(taskCreatedAt, createdAt);
            const minEarliestStart = Math.max(0, daysSinceGroupCreation);

            if (current.dependencies && current.dependencies.length > 0) {
                const maxDependencyFinish = Math.max(
                    ...current.dependencies.map(depId => taskMap.get(extractId(depId))?.earliestFinish || 0)
                );
                current.earliestStart = Math.max(maxDependencyFinish, minEarliestStart);
            } else {
                current.earliestStart = minEarliestStart;
            }

            current.earliestFinish = current.earliestStart + getTaskExpectedDuration(current);

            nodes.forEach(node => {
                if (node.dependencies && node.dependencies.some(d => extractId(d) === currentId)) {
                    queue.push(node);
                }
            });
        }

        const maxEarliestFinish = Math.max(...nodes.map(node => node.earliestFinish || 0));

        const endNodes = nodes.filter(node => 
            !nodes.some(n => n.dependencies && n.dependencies.some(d => extractId(d) === extractId(node._id)))
        );

        const reverseQueue = [...endNodes];
        const reverseVisited = new Set();

        while (reverseQueue.length > 0) {
            const current = reverseQueue.shift();
            const currentId = extractId(current._id);
            if (reverseVisited.has(currentId)) continue;
            reverseVisited.add(currentId);

            if (!nodes.some(node => node.dependencies && node.dependencies.some(d => extractId(d) === currentId))) {
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
                        .filter(node => node.dependencies && node.dependencies.some(d => extractId(d) === currentId))
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
                    const dep = taskMap.get(extractId(depId));
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

export const optimizeSchedule = (tasks, members = [], groupCreatedAt, permissions = [], projectOwnerId = null) => {
    if (!Array.isArray(tasks) || tasks.length === 0) {
        return [];
    }

    const timedTasks = tasks[0]?.earliestStartDate !== undefined
        ? tasks
        : calculateTimings(tasks, groupCreatedAt);

    const baseCreatedAt = new Date(groupCreatedAt || new Date());
    baseCreatedAt.setHours(0, 0, 0, 0);

    const minDateTs = Math.min(
        baseCreatedAt.getTime(),
        ...timedTasks.map(t => new Date(t.createdAt || baseCreatedAt).getTime())
    );
    const minStartDate = new Date(minDateTs);
    minStartDate.setHours(0, 0, 0, 0);

    // Целочисленні календарні дні для стійкого позиціонування на сітці
    const getDuration = (t) => getTaskExpectedDuration(t);

    const getPriorityScore = (priority) => {
        if (priority === 'high') return 3;
        if (priority === 'medium') return 2;
        return 1;
    };

    const validMembers = Array.isArray(members) && members.length > 0 ? members : [];

    // Перевірка прав: спостерігачі (viewer) не повинні отримувати задачі в автоматичному розподілі!
    const isMemberEligible = (memberId) => {
        const mid = extractId(memberId);
        if (!mid) return false;
        // Власник проєкту завжди може виконувати задачі
        if (projectOwnerId && extractId(projectOwnerId) === mid) return true;
        // Перевіряємо роль у дозволах
        const perm = (permissions || []).find(p => extractId(p.userId) === mid);
        if (perm && perm.role === 'viewer') return false;
        return true;
    };

    const taskMap = new Map();
    timedTasks.forEach(task => {
        const taskId = extractId(task._id);
        const rawDeps = Array.isArray(task.dependencies) ? task.dependencies : [];
        const validDeps = rawDeps
            .map(extractId)
            .filter(depId => depId && timedTasks.some(t => extractId(t._id) === depId));

        const duration = getDuration(task);
        const taskCreatedAt = new Date(task.createdAt || minStartDate);
        taskCreatedAt.setHours(0, 0, 0, 0);
        const minReadyDay = Math.max(0, Math.floor((taskCreatedAt - minStartDate) / (1000 * 60 * 60 * 24)));

        let deadlineDay = Infinity;
        if (task.deadline) {
            const dl = new Date(task.deadline);
            dl.setHours(0, 0, 0, 0);
            deadlineDay = Math.max(0, Math.floor((dl - minStartDate) / (1000 * 60 * 60 * 24)));
        }

        taskMap.set(taskId, {
            ...task,
            _id: task._id,
            taskId,
            dependencies: validDeps,
            duration,
            minReadyDay,
            deadlineDay,
            slack: typeof task.slack === 'number' ? task.slack : 0,
            priorityScore: getPriorityScore(task.priority),
            assignedTo: task.assignedTo ? extractId(task.assignedTo) : null,
        });
    });

    const executorList = validMembers.length > 0
        ? validMembers.map(m => ({
            id: extractId(m._id),
            member: m,
            availableAtDay: 0,
            tasks: [],
            totalWorkDays: 0,
            isEligible: isMemberEligible(m._id),
        }))
        : [{
            id: '__default_executor__',
            member: { _id: '__default__', fullName: 'Основний виконавець' },
            availableAtDay: 0,
            tasks: [],
            totalWorkDays: 0,
            isEligible: true,
        }];

    const executorMap = new Map(executorList.map(e => [e.id, e]));

    // Пул для авторозподілу: тільки учасники з правом виконання (виключаючи viewer)
    const eligibleAutoExecutors = executorList.filter(e => e.isEligible);
    const autoPool = eligibleAutoExecutors.length > 0 ? eligibleAutoExecutors : executorList;

    const scheduled = new Map();
    const remainingTaskIds = new Set(taskMap.keys());

    const compareReadyTasks = (idA, idB) => {
        const a = taskMap.get(idA);
        const b = taskMap.get(idB);

        // 1. Critical Path (minimum slack has priority)
        if (a.slack !== b.slack) {
            return a.slack - b.slack;
        }

        // 2. Earliest Deadline First (EDF)
        if (a.deadlineDay !== b.deadlineDay) {
            return a.deadlineDay - b.deadlineDay;
        }

        // 3. User-defined Priority (high > medium > low)
        if (a.priorityScore !== b.priorityScore) {
            return b.priorityScore - a.priorityScore;
        }

        // 4. Shortest Processing Time (SPT)
        return a.duration - b.duration;
    };

    while (remainingTaskIds.size > 0) {
        const ready = [];
        for (const taskId of remainingTaskIds) {
            const task = taskMap.get(taskId);
            const allDepsScheduled = task.dependencies.every(depId => scheduled.has(extractId(depId)));
            if (allDepsScheduled) {
                ready.push(taskId);
            }
        }

        if (ready.length === 0) {
            const fallbackId = remainingTaskIds.values().next().value;
            ready.push(fallbackId);
        }

        ready.sort(compareReadyTasks);

        const currentTaskId = ready[0];
        remainingTaskIds.delete(currentTaskId);
        const task = taskMap.get(currentTaskId);

        // Найраніший день, коли гарантовано виконані ВСІ залежності
        let depFinishDay = 0;
        for (const depId of task.dependencies) {
            const depSchedule = scheduled.get(extractId(depId));
            if (depSchedule && depSchedule.finishDay > depFinishDay) {
                depFinishDay = depSchedule.finishDay;
            }
        }

        const earliestReadyDay = Math.max(task.minReadyDay, depFinishDay);

        let chosenExecutor = null;
        let isAutoAssigned = false;

        if (task.assignedTo && executorMap.has(task.assignedTo)) {
            chosenExecutor = executorMap.get(task.assignedTo);
        } else {
            // Розподіляємо тільки серед доступних виконавців (не viewer)
            chosenExecutor = autoPool.reduce((best, exec) => {
                const execStart = Math.max(earliestReadyDay, exec.availableAtDay);
                const bestStart = Math.max(earliestReadyDay, best.availableAtDay);

                if (execStart < bestStart) return exec;
                if (execStart > bestStart) return best;
                return exec.totalWorkDays < best.totalWorkDays ? exec : best;
            }, autoPool[0]);

            isAutoAssigned = validMembers.length > 0;
        }

        // Задача суворо не може початися раніше завершення її залежностей (earliestReadyDay)
        const actualStartDay = Math.max(earliestReadyDay, chosenExecutor.availableAtDay);
        const actualFinishDay = actualStartDay + task.duration;
        const delayDays = actualStartDay - earliestReadyDay;

        chosenExecutor.availableAtDay = actualFinishDay;
        chosenExecutor.totalWorkDays += task.duration;

        scheduled.set(currentTaskId, {
            startDay: actualStartDay,
            finishDay: actualFinishDay,
            executorId: chosenExecutor.id,
        });

        const startDate = new Date(minStartDate);
        startDate.setDate(minStartDate.getDate() + actualStartDay);

        const finishDate = new Date(minStartDate);
        finishDate.setDate(minStartDate.getDate() + actualFinishDay);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlineDate = task.deadline ? new Date(task.deadline) : null;
        if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0);
        const deadlineMissed = deadlineDate ? (deadlineDate < today || finishDate > deadlineDate) : false;

        const updatedRisk = calculateDeadlineRisk({
            ...task,
            earliestStartDate: startDate,
            earliestFinishDate: finishDate,
        });

        const optimizedTask = {
            ...task,
            earliestStartDate: startDate,
            earliestFinishDate: finishDate,
            optimizedStartDate: startDate,
            optimizedFinishDate: finishDate,
            actualStartDay,
            actualFinishDay,
            duration: task.duration,
            delayDays,
            isOptimized: true,
            autoAssigned: isAutoAssigned,
            assignedTo: chosenExecutor.member?._id !== '__default__' ? chosenExecutor.member?._id : null,
            assignedMember: chosenExecutor.member,
            offsetY: 0,
            deadlineMissed,
            ...updatedRisk,
        };

        chosenExecutor.tasks.push(optimizedTask);
    }

    const resultExecutors = executorList
        .filter(exec => exec.tasks.length > 0)
        .map(exec => {
            exec.tasks.sort((a, b) => a.actualStartDay - b.actualStartDay);
            return {
                member: exec.member,
                tasks: exec.tasks,
                maxLevel: 0,
            };
        });

    return resultExecutors;
};

export const calculateDeadlineRisk = (task, today = new Date()) => {
    if (!task.deadline) {
        return {
            riskScore: 0,
            riskLevel: 'low',
            riskReason: 'Дедлайн не задано',
            completionProbability: null,
            zScore: null,
        };
    }

    if (!task.status) {
        return {
            riskScore: 0,
            riskLevel: 'low',
            riskReason: 'Задачу виконано',
            completionProbability: 100,
            zScore: null,
        };
    }

    const deadline = new Date(task.deadline);
    const hasPertRisk = task.pert && Number(task.pert.standardDeviation) > 0 && Number(task.pert.expected) > 0;
    const duration = Math.max(1, Number(task.duration) || 1);
    const expectedDuration = hasPertRisk ? Math.max(1, Number(task.pert.expected)) : duration;
    const standardDeviation = hasPertRisk ? Math.max(0, Number(task.pert.standardDeviation)) : 0;
    const plannedStart = task.earliestStartDate ? new Date(task.earliestStartDate) : new Date(today);
    const daysAvailableForTask = getDaysDifference(deadline, plannedStart);

    const todayZero = new Date(today);
    todayZero.setHours(0, 0, 0, 0);
    const deadlineZero = new Date(deadline);
    deadlineZero.setHours(0, 0, 0, 0);
    const isPastDeadline = deadlineZero < todayZero;

    const taskProb = calculateCompletionProbability(daysAvailableForTask, expectedDuration, standardDeviation);
    const completionProbability = taskProb ? taskProb.probability : 0;
    const zScore = taskProb ? taskProb.zScore : 0;

    let riskScore;
    let riskLevel;
    let riskReason;

    if (isPastDeadline) {
        riskScore = 100;
        riskLevel = 'high';
        riskReason = 'Дедлайн уже минув';
    } else {
        riskScore = Number((100 - completionProbability).toFixed(1));
        if (completionProbability >= 75) {
            riskLevel = 'low';
            riskReason = 'Достатній запас часу';
        } else if (completionProbability >= 50) {
            riskLevel = 'medium';
            riskReason = 'Помірний ризик: дедлайн близько';
        } else {
            riskLevel = 'high';
            riskReason = 'Високий ризик: бракує часу до дедлайну';
        }
    }

    return {
        riskScore,
        riskLevel,
        riskReason,
        completionProbability: isPastDeadline ? 0 : completionProbability,
        zScore,
    };
};

export const calculateTaskRisk = calculateDeadlineRisk;

export const calculateNormalCDF = (z) => {
    if (typeof z !== 'number' || isNaN(z)) return 0.5;
    if (z > 6) return 1;
    if (z < -6) return 0;

    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;

    const x = Math.abs(z);
    const t = 1 / (1 + p * x);
    const pdf = (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
    const cdf = 1 - pdf * (b1 * t + b2 * Math.pow(t, 2) + b3 * Math.pow(t, 3) + b4 * Math.pow(t, 4) + b5 * Math.pow(t, 5));

    return z < 0 ? 1 - cdf : cdf;
};

export const calculateCompletionProbability = (tDeadline, tExpected, varianceOrStdDev, isVariance = false) => {
    if (tDeadline === null || tDeadline === undefined || isNaN(tDeadline)) return null;
    if (tExpected === null || tExpected === undefined || isNaN(tExpected)) return null;

    const stdDev = isVariance ? Math.sqrt(Math.max(0, varianceOrStdDev || 0)) : (varianceOrStdDev || 0);

    if (stdDev <= 0) {
        return {
            probability: tDeadline >= tExpected ? 100 : 0,
            zScore: tDeadline >= tExpected ? Infinity : -Infinity,
        };
    }

    const z = (tDeadline - tExpected) / stdDev;
    const probability = calculateNormalCDF(z) * 100;

    return {
        probability: Math.min(100, Math.max(0, probability)),
        zScore: z,
    };
};

export const calculateProjectDeadlineProbability = (tasks, projectPert, startDate) => {
    if (!Array.isArray(tasks) || tasks.length === 0 || !projectPert) {
        return null;
    }

    const tasksWithDeadline = tasks.filter(t => t.deadline);
    if (tasksWithDeadline.length === 0) {
        return null;
    }

    const maxDeadlineDate = new Date(Math.max(...tasksWithDeadline.map(t => new Date(t.deadline).getTime())));
    const projectStartDate = new Date(startDate || (tasks[0] && tasks[0].createdAt) || new Date());

    const dStart = new Date(projectStartDate);
    const dDeadline = new Date(maxDeadlineDate);
    dStart.setHours(0, 0, 0, 0);
    dDeadline.setHours(0, 0, 0, 0);

    const tDeadline = Math.max(0, Math.floor((dDeadline - dStart) / (1000 * 60 * 60 * 24)));
    const tExpected = projectPert.expected || 0;
    const stdDev = projectPert.standardDeviation !== undefined
        ? projectPert.standardDeviation
        : Math.sqrt(projectPert.variance || 0);

    const result = calculateCompletionProbability(tDeadline, tExpected, stdDev);
    if (!result) return null;

    return {
        ...result,
        tDeadline,
        tExpected,
        stdDev,
        deadlineDate: maxDeadlineDate,
    };
};

export const getTaskTooltip = (task) => {
    const lines = [task.title];

    if (task.description) {
        lines.push(`Опис: ${task.description}`);
    }

    if (task.autoAssigned && task.assignedMember) {
        lines.push(`⚡ Автопризначено: ${task.assignedMember.fullName || task.assignedMember.email}`);
    }

    if (task.delayDays && task.delayDays > 0) {
        lines.push(`⏳ Зсув розкладу: +${task.delayDays} дн. (через зайнятість виконавця)`);
    }

    if (task.earliestStartDate && task.earliestFinishDate) {
        const startStr = new Date(task.earliestStartDate).toLocaleDateString('uk-UA');
        const finishStr = new Date(task.earliestFinishDate).toLocaleDateString('uk-UA');
        lines.push(`Період виконання: ${startStr} – ${finishStr}`);
    }

    if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        lines.push(`Дедлайн: ${deadlineDate.toLocaleDateString('uk-UA')}`);

        if (!task.status) {
            lines.push('Статус: Виконано');
        } else if (task.completionProbability !== null && task.completionProbability !== undefined) {
            lines.push(`Ймовірність встигнути: ${task.completionProbability.toFixed(1)}%`);
        }
    } else {
        lines.push('Дедлайн: не задано');
    }

    const hasPertRisk = task.pert && Number(task.pert.standardDeviation || 0) > 0;
    if (hasPertRisk && task.pert?.expected) {
        const expected = Number(task.pert.expected).toFixed(1);
        const stdDev = Number(task.pert.standardDeviation || 0).toFixed(1);
        lines.push(`Очікувана тривалість (PERT): ${expected} дн. (±${stdDev} дн.)`);
    } else {
        lines.push(`Тривалість: ${task.duration || task.pert?.expected || 1} дн.`);
    }

    if (task.status && task.riskScore !== undefined && task.deadline) {
        lines.push(`Ризик запізнення: ${task.riskScore}% (${task.riskReason || ''})`);
    }

    return lines.join('\n');
};