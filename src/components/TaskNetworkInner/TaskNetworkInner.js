import React, { useState, useEffect } from 'react';
import ReactFlow, { 
    Background, 
    Controls, 
    MiniMap, 
    useNodesState, 
    useEdgesState,
    Handle,
} from 'reactflow';
import { useNavigate } from 'react-router-dom';
import styles from './TaskNetworkInner.module.css';
import 'reactflow/dist/style.css';
import MyButton from '../../components/ui/button/MyButton';
import { FaArrowLeft } from 'react-icons/fa';

const CustomNode = ({ data, className }) => {
    return (
        <div className={className}>
            <Handle
                type="source"
                position="right"
                style={{ background: '#555', borderRadius: '50%', width: '8px', height: '8px' }}
            />
            <div>{data.label}</div>
            <Handle
                type="target"
                position="left"
                style={{ background: '#555', borderRadius: '50%', width: '8px', height: '8px' }}
            />
        </div>
    );
};

const nodeTypes = {
    customNode: CustomNode,
};

const TaskNetworkInner = ({
    initialData,
    onNodesChangeHandler,
    groups = [],
    selectedGroupId = 'all',
    onSelectGroup,
    selectedGroup = null,
}) => {
    const navigate = useNavigate();
    const [isInteractive, setIsInteractive] = useState(true);
    const [nodes, setNodes, onNodesChange] = useNodesState(initialData.initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialData.initialEdges);

    useEffect(() => {
        setNodes(initialData.initialNodes);
        setEdges(initialData.initialEdges);
    }, [initialData, setNodes, setEdges]);

    const handleInteractToggle = () => {
        setIsInteractive((prev) => !prev);
    };

    const handleNodesChange = (changes) => {
        onNodesChange(changes);
        onNodesChangeHandler(changes);
    };

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

            <h1 className={styles.title}>
                {selectedGroup ? `Мережевий графік: ${selectedGroup.title}` : 'Мережевий графік завдань'}
            </h1>

            <div className={styles.controlsBar}>
                <div className={styles.filterGroup}>
                    <label className={styles.filterLabel} htmlFor="project-network-filter">
                        Проєкт:
                    </label>
                    <select
                        id="project-network-filter"
                        className={styles.projectSelect}
                        value={selectedGroupId}
                        onChange={(e) => onSelectGroup(e.target.value)}
                    >
                        <option value="all">Усі проєкти ({groups.length})</option>
                        {groups.map((g) => (
                            <option key={g._id} value={g._id}>
                                {g.title} ({g.tasks?.length || 0} задач)
                            </option>
                        ))}
                    </select>
                    {selectedGroupId !== 'all' && (
                        <button
                            type="button"
                            className={styles.resetFilterButton}
                            onClick={() => onSelectGroup('all')}
                            title="Показати всі проєкти"
                        >
                            Всі проєкти
                        </button>
                    )}
                </div>

                <div className={styles.actionButtons}>
                    <MyButton
                        onClick={initialData.handleResetPositions}
                        className={styles.resetButton}
                    >
                        Скинути позиції
                    </MyButton>

                    <button
                        type="button"
                        className={styles.ganttLinkButton}
                        onClick={() => {
                            if (selectedGroupId !== 'all') {
                                navigate(`/gantt?group=${selectedGroupId}`);
                            } else {
                                navigate('/gantt');
                            }
                        }}
                    >
                        Діаграма Ганта
                    </button>
                </div>

                <div className={styles.legend} aria-label="Легенда вузлів">
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendSwatch} ${styles.legendNormal}`} /> Звичайна
                    </span>
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendSwatch} ${styles.legendPriority}`} /> Пріоритетна
                    </span>
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendSwatch} ${styles.legendMissed}`} /> Прострочена
                    </span>
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendSwatch} ${styles.legendEnd}`} /> Кінець
                    </span>
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendMarker} ${styles.earlyMarker}`} /> Ранні терміни
                    </span>
                    <span className={styles.legendItem}>
                        <i className={`${styles.legendMarker} ${styles.lateMarker}`} /> Пізні терміни
                    </span>
                </div>
            </div>

            <div className={styles.graphWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                    minZoom={0.05}
                    maxZoom={3}
                    nodesDraggable={isInteractive}
                    nodesConnectable={false}
                    elementsSelectable={true}
                    nodeTypes={nodeTypes}
                >
                    <Background />
                    <Controls onInteractiveChange={handleInteractToggle} />
                    <MiniMap />
                </ReactFlow>
            </div>
        </div>
    );
};

export default TaskNetworkInner;