import React, { useState } from 'react';
import MyButton from '../ui/button/MyButton';
import MyInput from '../ui/input/MyInput';
import { useDispatch } from 'react-redux';
import { fetchCreateGroup, fetchGroups } from '../../redux/slices/groups';
import { useToast } from '../../context/ToastContext';

const AddGroupForm = ({ setModalGroupVisible }) => {
    const [title, setTitle] = useState('');
    const dispatch = useDispatch();
    const { showToast } = useToast();

    const addNewGroup = (e) => {
        e.preventDefault();
        if (!title.trim()) {
            showToast('Введіть назву проєкту', 'error');
            return;
        }
        const newGroup = {
            title: title.trim(),
            tasks: [],
        };
        dispatch(fetchCreateGroup(newGroup))
            .then(() => {
                showToast(`Проєкт "${newGroup.title}" створено!`, 'success');
                dispatch(fetchGroups());
                setModalGroupVisible(false);
                setTitle('');
            })
            .catch((error) => {
                showToast(error.response?.data?.message || 'Помилка при створенні проєкту', 'error');
            });
    };

    return (
        <div>
            <form>
                <MyInput 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                    type="text" 
                    placeholder="Назва проєкту"
                />
                <MyButton onClick={addNewGroup}>Додати проєкт</MyButton>
            </form>
        </div>
    );
};

export default AddGroupForm;