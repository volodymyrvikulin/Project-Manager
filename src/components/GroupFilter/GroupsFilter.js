import React from 'react';
import styles from './GroupsFilter.module.css';
import { FaSearch, FaTimes, FaUserCheck, FaUndo } from 'react-icons/fa';

const GroupsFilter = ({
    filter,
    setFilter,
    members = [],
    currentUserId,
    totalFoundTasks,
}) => {
    const isMyTasksActive = filter.assignedTo === 'my';
    const isFilterActive = Boolean(filter.searchTask || filter.assignedTo || filter.selectedSort);

    const handleToggleMyTasks = () => {
        setFilter(prev => ({
            ...prev,
            assignedTo: prev.assignedTo === 'my' ? '' : 'my',
        }));
    };

    const handleClearSearch = () => {
        setFilter(prev => ({
            ...prev,
            searchTask: '',
            searchGroup: '',
        }));
    };

    const handleResetAll = () => {
        setFilter({
            searchTask: '',
            searchGroup: '',
            selectedSort: '',
            assignedTo: '',
        });
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setFilter(prev => ({
            ...prev,
            searchTask: val.toLowerCase(),
            searchGroup: val.toLowerCase(),
        }));
    };

    const sortOptions = [
        { value: '', name: 'Без сортування' },
        { value: 'groupTitle', name: 'За назвою проєкту' },
        { value: 'taskTitle', name: 'За назвою задачі' },
        { value: 'createdAtAsc', name: 'За датою створення (спочатку старі)' },
        { value: 'createdAtDesc', name: 'За датою створення (спочатку нові)' },
        { value: 'deadlineAsc', name: 'За дедлайном (спочатку ранні)' },
        { value: 'deadlineDesc', name: 'За дедлайном (спочатку пізні)' },
    ];

    const otherMembers = members.filter(m => m && m._id && m._id.toString() !== currentUserId?.toString());

    return (
        <div className={styles.filterContainer}>
            <div className={styles.topRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        className={styles.searchInput}
                        value={filter.searchTask || ''}
                        onChange={handleSearchChange}
                        placeholder="Пошук задач (назва або опис)..."
                    />
                    {filter.searchTask && (
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className={styles.clearSearchBtn}
                            title="Очистити пошук"
                        >
                            <FaTimes />
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleToggleMyTasks}
                    className={`${styles.myTasksQuickBtn} ${isMyTasksActive ? styles.myTasksQuickBtnActive : ''}`}
                    title="Показати тільки задачі, призначені на мене"
                >
                    <FaUserCheck />
                    <span>Тільки мої задачі</span>
                </button>
            </div>

            <div className={styles.filtersRow}>
                <div className={styles.selectGroup}>
                    <select
                        value={filter.assignedTo || ''}
                        onChange={e => setFilter(prev => ({ ...prev, assignedTo: e.target.value }))}
                        aria-label="Фільтр за виконавцем"
                    >
                        <option value="">Усі виконавці</option>
                        <option value="my">👤 Тільки мої задачі</option>
                        <option value="unassigned">⚪ Без виконавця</option>
                        {otherMembers.length > 0 && (
                            <optgroup label="Учасники команди">
                                {otherMembers.map(m => (
                                    <option key={m._id} value={m._id}>
                                        {m.fullName} ({m.email})
                                    </option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                <div className={styles.selectGroup}>
                    <select
                        value={filter.selectedSort || ''}
                        onChange={e => setFilter(prev => ({ ...prev, selectedSort: e.target.value }))}
                        aria-label="Сортування"
                    >
                        <option value="">Сортування...</option>
                        {sortOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.name}
                            </option>
                        ))}
                    </select>
                </div>

                {isFilterActive && (
                    <button
                        type="button"
                        onClick={handleResetAll}
                        className={styles.resetBtn}
                        title="Скинути всі фільтри та пошук"
                    >
                        <FaUndo /> Скинути фільтри
                    </button>
                )}

                {totalFoundTasks !== undefined && isFilterActive && (
                    <div className={styles.filterStats}>
                        Знайдено задач: <span className={styles.filterBadge}>{totalFoundTasks}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupsFilter;