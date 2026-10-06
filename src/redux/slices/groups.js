import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../axios.js';

export const fetchGroups = createAsyncThunk('groups/fetchGroups', async () => {
    const { data } = await axios.get('/groups');
    return data;
});

export const fetchCreateGroup = createAsyncThunk('groups/fetchCreateGroup', async (params) => {
    const { data } = await axios.post('/groups', params);
    return data;
});

export const fetchRemoveGroup = createAsyncThunk('groups/fetchRemoveGroup', async (id) => {
    await axios.delete(`/groups/${id}`);
});

export const fetchUpdateGroup = createAsyncThunk('groups/fetchUpdateGroup', async ({ updatedGroup, groupId }) => {
    const { data } = await axios.patch(`/groups/${groupId}`, updatedGroup);
    return data;
});

export const fetchCreateTask = createAsyncThunk('groups/fetchCreateTask', async ({ newTask, id }) => {
    const taskWithDependencies = { ...newTask, dependencies: newTask.dependencies || [] };
    const { data } = await axios.post(`/tasks/${id}`, taskWithDependencies);
    return data;
});

export const fetchGenerateTasks = createAsyncThunk('groups/fetchGenerateTasks', async ({ description, id }) => {
    const { data } = await axios.post(`/ai/groups/${id}/tasks`, { description });
    return data.tasks;
});

export const fetchDeleteTask = createAsyncThunk('groups/fetchDeleteTask', async ({ groupId, taskId }) => {
    const { data } = await axios.delete(`/tasks/${groupId}/${taskId}/`);
    return data;
});

export const fetchUpdateTask = createAsyncThunk('groups/fetchUpdateTask', async ({ updatedTask, groupId, taskId }) => {
    const { data } = await axios.patch(`/tasks/${groupId}/${taskId}/`, updatedTask);
    return data;
});

export const fetchInviteUser = createAsyncThunk('groups/fetchInviteUser', async ({ groupId, email }) => {
    const { data } = await axios.post(`/groups/${groupId}/invite`, { email });
    return { groupId, message: data.message, group: data.group };
});

export const fetchRemoveUser = createAsyncThunk('groups/fetchRemoveUser', async ({ groupId, userId }) => {
    const { data } = await axios.post(`/groups/${groupId}/remove-user`, { userId });
    return { groupId, userId, message: data.message };
});

export const fetchUpdatePermissions = createAsyncThunk('groups/fetchUpdatePermissions', async ({ groupId, userId, canAddTasks, canEditTasks, canDeleteTasks }) => {
    const { data } = await axios.patch(`/groups/${groupId}/permissions`, { userId, canAddTasks, canEditTasks, canDeleteTasks });
    return { groupId, updatedGroup: data };
});

const initialState = {
    groups: {
        items: [],
        status: 'loading',
    },
    nodePositions: {},
};

const groupsSlice = createSlice({
    name: 'groups',
    initialState,
    reducers: {
        setNodePositions(state, action) {
            state.nodePositions = { ...state.nodePositions, ...action.payload };
        },
        resetNodePositions(state) {
            state.nodePositions = {};
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchGroups.pending, (state) => {
                state.groups.status = 'loading';
                state.groups.items = [];
            })
            .addCase(fetchGroups.fulfilled, (state, action) => {
                state.groups.status = 'loaded';
                state.groups.items = action.payload;
            })
            .addCase(fetchGroups.rejected, (state) => {
                state.groups.status = 'error';
                state.groups.items = [];
            })
            .addCase(fetchCreateGroup.fulfilled, (state, action) => {
                state.groups.items = [...state.groups.items, action.payload];
            })
            .addCase(fetchRemoveGroup.pending, (state, action) => {
                state.groups.items = state.groups.items.filter(({ _id }) => _id !== action.meta.arg);
            })
            .addCase(fetchUpdateGroup.fulfilled, (state, action) => {
                const { groupId } = action.meta.arg;
                state.groups.items = state.groups.items.map((group) => (group._id === groupId ? action.payload : group));
            })
            .addCase(fetchCreateTask.fulfilled, (state, action) => {
                const { id } = action.meta.arg;
                state.groups.items = state.groups.items.map((group) =>
                    group._id === id ? { ...group, tasks: [...group.tasks, action.payload] } : group
                );
            })
            .addCase(fetchDeleteTask.fulfilled, (state, action) => {
                const { groupId } = action.meta.arg;
                state.groups.items = state.groups.items.reduce((acc, group) => {
                    if (group._id === groupId) {
                        return [...acc, { ...group, tasks: action.payload }];
                    }
                    return [...acc, group];
                }, []);
            })
            .addCase(fetchUpdateTask.fulfilled, (state, action) => {
                const { groupId } = action.meta.arg;
                state.groups.items = state.groups.items.map((group) =>
                    group._id === groupId ? { ...group, tasks: action.payload } : group
                );
            })
            .addCase(fetchInviteUser.fulfilled, (state, action) => {
                const { groupId, group } = action.payload;
                state.groups.items = state.groups.items.map((g) =>
                    g._id === groupId ? { ...g, ...group } : g
                );
            })
            .addCase(fetchRemoveUser.fulfilled, (state, action) => {
                const { groupId, userId } = action.payload;
                state.groups.items = state.groups.items.map((group) =>
                    group._id === groupId
                        ? {
                              ...group,
                              members: group.members.filter((member) => member._id.toString() !== userId),
                              invitedUsers: group.invitedUsers.filter(
                                  (invite) => invite.userId.toString() !== userId
                              ),
                          }
                        : group
                );
            })
            .addCase(fetchUpdatePermissions.fulfilled, (state, action) => {
                const { groupId, updatedGroup } = action.payload;
                state.groups.items = state.groups.items.map((g) =>
                    g._id === groupId ? { ...g, ...updatedGroup } : g
                );
            });
    },
});

export const { setNodePositions, resetNodePositions } = groupsSlice.actions;

export const selectGroups = (state) => state.groups;

export default groupsSlice.reducer;