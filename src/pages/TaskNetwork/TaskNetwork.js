import React, { useMemo, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { useSelector, useDispatch } from 'react-redux';
import { selectGroups, fetchGroups, setNodePositions, resetNodePositions } from '../../redux/slices/groups';
import dagre from 'dagre';
import TaskNetworkInner from '../../components/TaskNetworkInner/TaskNetworkInner';
import { calculateTimings } from '../../utils/ganttUtils';
import styles from '../../pages/TaskNetwork/TaskNetwork.module.css';
import { selectIsAuth } from '../../redux/slices/auth';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

const createDagreGraph = () => {
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    return graph;
};

const getLayoutedElementsForGroup = (nodes, edges) => {
    const dagreGraph = createDagreGraph();
    dagreGraph.setGraph({ 
        rankdir: 'LR',
        nodesep: 80,
        ranksep: 160,
    });

    nodes.forEach((node) => {
        const width = node.width || 200;
        const height = node.height || 140;
        dagreGraph.setNode(node.id, { width, height });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    const nodesWithoutEdges = nodes.filter(
        (node) => !edges.some((edge) => edge.source === node.id || edge.target === node.id)
    );

    for (let i = 0; i < nodesWithoutEdges.length - 1; i++) {
        dagreGraph.setEdge(nodesWithoutEdges[i].id, nodesWithoutEdges[i + 1].id, { style: 'invis' });
    }

    if (nodesWithoutEdges.length > 0 && nodes.length > nodesWithoutEdges.length) {
        const firstNodeWithEdges = nodes.find((node) =>
            edges.some((edge) => edge.source === node.id || edge.target === node.id)
        );
        if (firstNodeWithEdges) {
            dagreGraph.setEdge(firstNodeWithEdges.id, nodesWithoutEdges[0].id, { style: 'invis' });
        }
    }

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        const width = node.width || 200;
        const height = node.height || 140;
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - (width / 2),
                y: nodeWithPosition.y - (height / 2),
            },
        };
    });

    return { nodes: layoutedNodes, edges };
};

const TaskNetwork = () => {
    const isAuth = useSelector(selectIsAuth);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { groupId: routeGroupId } = useParams();
    const [searchParams] = useSearchParams();
    const { groups, nodePositions } = useSelector(selectGroups);

    const selectedGroupId = routeGroupId || searchParams.get('group') || 'all';

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    const filteredGroups = useMemo(() => {
        if (!groups.items) return [];
        if (selectedGroupId === 'all') return groups.items;
        return groups.items.filter((g) => g._id === selectedGroupId);
    }, [groups.items, selectedGroupId]);

    const selectedGroup = useMemo(() => {
        if (selectedGroupId === 'all') return null;
        return groups.items.find((g) => g._id === selectedGroupId) || null;
    }, [groups.items, selectedGroupId]);

    const initialData = useMemo(() => {
        if (!groups.items || !groups.items.length) {
            return {
                initialNodes: [
                    {
                        id: 'no-tasks',
                        type: 'customNode',
                        data: { label: 'Додайте задачі для відображення графіка' },
                        position: { x: 100, y: 100 },
                        className: styles.node,
                    }
                ],
                initialEdges: [],
                handleResetPositions: () => dispatch(resetNodePositions()),
            };
        }

        if (selectedGroupId !== 'all' && filteredGroups.length === 0) {
            return {
                initialNodes: [
                    {
                        id: 'not-found',
                        type: 'customNode',
                        data: {
                            label: (
                                <div>
                                    <strong>Проєкт не знайдено або він був видалений</strong>
                                </div>
                            ),
                        },
                        position: { x: 100, y: 100 },
                        className: styles.node,
                    }
                ],
                initialEdges: [],
                handleResetPositions: () => dispatch(resetNodePositions()),
            };
        }

        let allNodes = [];
        let allEdges = [];
        let groupOffsetY = 0;

        filteredGroups.forEach((group) => {
            const rawTasks = group.tasks || [];
            if (rawTasks.length === 0) return;

            const groupNodes = [];
            const groupEdges = [];

            const tasksWithTimings = calculateTimings(rawTasks, group.createdAt).map(task => ({
                ...task,
                groupId: group._id,
                members: group.members || [],
            }));

            const existingTaskIds = new Set(tasksWithTimings.map(t => t._id));

            tasksWithTimings.forEach((task) => {
                const savedPosition = nodePositions[task._id];
                const nodeClass = task.deadlineMissed
                    ? `${styles.node} ${styles.nodeMissedDeadline}`
                    : task.priority
                    ? `${styles.node} ${styles.nodePriority}`
                    : `${styles.node} ${styles.nodeNormal}`;

                const startDate = task.earliestStartDate instanceof Date ? task.earliestStartDate : new Date(task.earliestStartDate);
                const finishDate = task.earliestFinishDate instanceof Date ? task.earliestFinishDate : new Date(task.earliestFinishDate);
                const latestStart = task.latestStartDate instanceof Date ? task.latestStartDate : new Date(task.latestStartDate);
                const latestFinish = task.latestFinishDate instanceof Date ? task.latestFinishDate : new Date(task.latestFinishDate);

                const titleToDisplay = `${task.title}${selectedGroupId === 'all' ? ` (${group.title})` : ''}`;
                const titleLines = Math.max(1, Math.ceil(titleToDisplay.length / 20));
                const estimatedNodeHeight = Math.max(130, 110 + titleLines * 20);

                groupNodes.push({
                    id: task._id,
                    type: 'customNode',
                    width: 200,
                    height: estimatedNodeHeight,
                    data: {
                        label: (
                            <div>
                                <strong>{task.title}{selectedGroupId === 'all' ? ` (${group.title})` : ''}</strong><br />
                                <span>Тривалість: {task.duration} дн.</span><br />
                                <div className={styles.termsWrapper}>
                                    <span className={styles.earlyTermMarker}></span>
                                    {startDate.toLocaleDateString()} – {finishDate.toLocaleDateString()}
                                </div>
                                <div className={styles.termsWrapper}>
                                    <span className={styles.lateTermMarker}></span>
                                    {latestStart.toLocaleDateString()} – {latestFinish.toLocaleDateString()}
                                </div>
                            </div>
                        ),
                    },
                    position: savedPosition || { x: 0, y: 0 },
                    className: nodeClass,
                });

                if (task.dependencies && task.dependencies.length > 0) {
                    task.dependencies.forEach((depId) => {
                        if (existingTaskIds.has(depId)) {
                            groupEdges.push({
                                id: `e-${depId}-${task._id}`,
                                source: depId,
                                target: task._id,
                                animated: true,
                                style: { stroke: '#777', strokeWidth: 2 },
                            });
                        }
                    });
                }
            });

            const endTasks = groupNodes.filter(
                (node) => !groupEdges.some((edge) => edge.source === node.id)
            );

            if (groupNodes.length > 0) {
                const endNodeId = `end-${group._id}`;
                groupNodes.push({
                    id: endNodeId,
                    type: 'customNode',
                    width: 160,
                    height: 80,
                    data: {
                        label: (
                            <div>
                                <strong>{selectedGroupId === 'all' ? `Кінець (${group.title})` : 'Кінець проєкту'}</strong>
                            </div>
                        ),
                    },
                    position: { x: 0, y: 0 },
                    className: `${styles.node} ${styles.nodeEnd}`,
                });

                endTasks.forEach((task) => {
                    groupEdges.push({
                        id: `e-${task.id}-${endNodeId}`,
                        source: task.id,
                        target: endNodeId,
                        animated: false,
                        style: { stroke: '#777', strokeWidth: 2 },
                    });
                });
            }

            const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElementsForGroup(groupNodes, groupEdges);

            const maxY = Math.max(...layoutedNodes.map(node => node.position.y + (node.height || 140)), 0);
            const groupHeight = maxY + 50;

            const offsetNodes = layoutedNodes.map(node => {
                const savedPosition = nodePositions[node.id];
                if (savedPosition) {
                    return { ...node, position: savedPosition };
                }
                return {
                    ...node,
                    position: {
                        x: node.position.x,
                        y: node.position.y + groupOffsetY,
                    },
                };
            });

            allNodes = [...allNodes, ...offsetNodes];
            allEdges = [...allEdges, ...layoutedEdges];

            groupOffsetY += groupHeight + 150;
        });

        if (allNodes.length === 0) {
            return {
                initialNodes: [
                    {
                        id: 'no-tasks',
                        type: 'customNode',
                        data: {
                            label: (
                                <div>
                                    <strong>
                                        {selectedGroupId !== 'all'
                                            ? 'У цьому проєкті ще немає створених задач'
                                            : 'Додайте задачі для відображення графіка'}
                                    </strong>
                                </div>
                            ),
                        },
                        position: { x: 100, y: 100 },
                        className: styles.node,
                    }
                ],
                initialEdges: [],
                handleResetPositions: () => dispatch(resetNodePositions()),
            };
        }

        return { 
            initialNodes: allNodes, 
            initialEdges: allEdges, 
            handleResetPositions: () => dispatch(resetNodePositions()) 
        };
    }, [groups.items, filteredGroups, selectedGroupId, nodePositions, dispatch]);

    const handleNodesChange = (changes) => {
        const positionUpdates = {};
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                positionUpdates[change.id] = change.position;
            }
        });
        if (Object.keys(positionUpdates).length > 0) {
            dispatch(setNodePositions(positionUpdates));
        }
    };

    const handleSelectGroup = (newGroupId) => {
        if (newGroupId === 'all') {
            navigate('/network');
        } else {
            navigate(`/network?group=${newGroupId}`);
        }
    };

    if (!isAuth) {
        return <Navigate to="/login" />;
    }
    
    return (
        <ReactFlowProvider>
            <TaskNetworkInner 
                initialData={initialData} 
                onNodesChangeHandler={handleNodesChange} 
                groups={groups.items || []}
                selectedGroupId={selectedGroupId}
                onSelectGroup={handleSelectGroup}
                selectedGroup={selectedGroup}
            />
        </ReactFlowProvider>
    );
};

export default TaskNetwork;