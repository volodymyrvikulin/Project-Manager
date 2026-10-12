import React, { useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Group from '../../components/Group/Group';
import AddGroupForm from '../../components/AddGroupForm/AddGroupForm';
import styles from './List.module.css';
import GroupsFilter from '../../components/GroupFilter/GroupsFilter';
import MyModal from '../../components/ui/modal/MyModal';
import { fetchGroups, fetchRemoveGroup, selectGroups } from '../../redux/slices/groups';
import { selectIsAuth, selectAuthData } from '../../redux/slices/auth';
import { Navigate, Link } from 'react-router-dom';
import Sidebar from '../../components/Sidebar/Sidebar';
import Header from '../../components/Header/Header';
import { FaChartBar, FaProjectDiagram, FaPlus, FaCalendar } from 'react-icons/fa';

const List = () => {
    const isAuth = useSelector(selectIsAuth);
    const dispatch = useDispatch();
    const { groups } = useSelector(selectGroups);
    const authData = useSelector(selectAuthData);
    const isGroupsLoading = groups.status === 'loading';

    useEffect(() => {
        dispatch(fetchGroups());
    }, [dispatch]);

    const [filter, setFilter] = useState({ selectedSort: '', searchTask: '', searchGroup: '', assignedTo: '' });
    const [modalGroupVisible, setModalGroupVisible] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(false);

    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };

    const removeGroup = (group) => {
        dispatch(fetchRemoveGroup(group._id));
    };

    const allMembers = useMemo(() => {
        const membersMap = new Map();
        (groups.items || []).forEach(group => {
            (group.members || []).forEach(m => {
                if (m && m._id && !membersMap.has(m._id.toString())) {
                    membersMap.set(m._id.toString(), m);
                }
            });
        });
        return Array.from(membersMap.values());
    }, [groups.items]);

    const sorted = useMemo(() => {
        const items = [...groups.items];
        if (filter.selectedSort === 'groupTitle') {
            return items.sort((a, b) => a.title.localeCompare(b.title));
        } else if (filter.selectedSort === 'taskTitle') {
            return items.map(group => ({
                ...group,
                tasks: [...group.tasks].sort((a, b) => a.title.localeCompare(b.title))
            }));
        } else if (filter.selectedSort === 'createdAtAsc') {
            return items.map(group => ({
                ...group,
                tasks: [...group.tasks].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
            }));
        } else if (filter.selectedSort === 'createdAtDesc') {
            return items.map(group => ({
                ...group,
                tasks: [...group.tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            }));
        } else if (filter.selectedSort === 'deadlineAsc') {
            return items.map(group => ({
                ...group,
                tasks: [...group.tasks].sort((a, b) => {
                    const dateA = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
                    const dateB = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
                    return dateA - dateB;
                })
            }));
        } else if (filter.selectedSort === 'deadlineDesc') {
            return items.map(group => ({
                ...group,
                tasks: [...group.tasks].sort((a, b) => {
                    const dateA = a.deadline ? new Date(a.deadline) : new Date('9999-12-31');
                    const dateB = b.deadline ? new Date(b.deadline) : new Date('9999-12-31');
                    return dateB - dateA;
                })
            }));
        }
        return items;
    }, [filter.selectedSort, groups.items]);

    const isFilteringActive = Boolean(filter.searchTask?.trim() || filter.assignedTo);

    const sortedAndFiltered = useMemo(() => {
        const query = (filter.searchTask || '').trim().toLowerCase();
        const assignee = filter.assignedTo || '';
        const isFiltering = Boolean(query || assignee);

        return sorted.map(group => {
            const allTasks = group.tasks || [];
            if (!isFiltering) {
                return {
                    ...group,
                    allTasks,
                };
            }

            const matchingTasks = allTasks.filter(task => {
                const matchesSearch = !query ||
                    (task.title && task.title.toLowerCase().includes(query)) ||
                    (task.description && task.description.toLowerCase().includes(query));

                let matchesAssignee = true;
                if (assignee === 'my') {
                    matchesAssignee = Boolean(authData?._id && task.assignedTo && task.assignedTo.toString() === authData._id.toString());
                } else if (assignee === 'unassigned') {
                    matchesAssignee = !task.assignedTo;
                } else if (assignee) {
                    matchesAssignee = Boolean(task.assignedTo && task.assignedTo.toString() === assignee.toString());
                }

                return matchesSearch && matchesAssignee;
            });

            return {
                ...group,
                allTasks,
                tasks: matchingTasks,
                totalTasksCount: allTasks.length,
                filteredTasksCount: matchingTasks.length,
            };
        }).filter(group => {
            if (isFiltering) {
                return group.tasks.length > 0;
            }
            return true;
        });
    }, [sorted, filter.searchTask, filter.assignedTo, authData]);

    const totalFoundTasks = useMemo(() => {
        return sortedAndFiltered.reduce((sum, g) => sum + (g.tasks ? g.tasks.length : 0), 0);
    }, [sortedAndFiltered]);

    if (!isAuth) {
        return <Navigate to='/login' />;
    }

    return (
        <>
            <Header toggleSidebar={toggleSidebar} />
            <div className={styles.listContainer}>
                <Sidebar 
                    isOpen={sidebarVisible} 
                    toggleSidebar={toggleSidebar} 
                    authData={authData} 
                    setModalGroupVisible={setModalGroupVisible} 
                />
                <div className={`${styles.mainContent} ${sidebarVisible ? styles.mainContentOpen : ''}`}>
                    <MyModal visible={modalGroupVisible} setVisible={setModalGroupVisible}>
                        <AddGroupForm setModalGroupVisible={setModalGroupVisible} />
                    </MyModal>
                    <GroupsFilter
                        filter={filter}
                        setFilter={setFilter}
                        members={allMembers}
                        currentUserId={authData?._id}
                        totalFoundTasks={totalFoundTasks}
                    />
                    <div className={styles.actions}>
                        <Link to="/statistics">
                            <button className={styles.iconButton} aria-label="Загальна статистика">
                                <FaChartBar />
                                <span className={styles.tooltip}>Загальна статистика</span>
                            </button>
                        </Link>
                        <Link to="/network">
                            <button className={styles.iconButton} aria-label="Мережевий графік">
                                <FaProjectDiagram />
                                <span className={styles.tooltip}>Мережевий графік</span>
                            </button>
                        </Link>
                        <Link to="/gantt">
                            <button className={styles.iconButton} aria-label="Діаграма Ганта">
                                <FaCalendar />
                                <span className={styles.tooltip}>Діаграма Ганта</span>
                            </button>
                        </Link>
                        <button onClick={() => setModalGroupVisible(true)} className={styles.iconButton} aria-label="Створити групу">
                            <FaPlus />
                            <span className={styles.tooltip}>Створити проєкт</span>
                        </button>
                    </div>
                    <div className={styles.groupsWrapper}>
                        {isGroupsLoading ? (
                            <h1 className={styles.list}>Завантаження</h1>
                        ) : sortedAndFiltered.length > 0 ? (
                            sortedAndFiltered.map((group) => (
                                <div className={styles.groupItem} key={group._id}>
                                    <Group
                                        group={group}
                                        removeGroup={removeGroup}
                                    />
                                </div>
                            ))
                        ) : isFilteringActive ? (
                            <div className={styles.emptyFilteredState}>
                                <h2 className={styles.emptyTitle}>За вашим запитом задач не знайдено</h2>
                                <button
                                    onClick={() => setFilter({ selectedSort: '', searchTask: '', searchGroup: '', assignedTo: '' })}
                                    className={styles.resetSearchBtn}
                                >
                                    Скинути фільтри та пошук
                                </button>
                            </div>
                        ) : (
                            <h1 className={styles.list}>Проєктів немає</h1>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default List;