import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from 'react-redux';
import { fetchAuthMe, selectAuthData } from '../redux/slices/auth';
import { fetchGroups } from '../redux/slices/groups';
import './App.css';
import Header from '../components/Header/Header';
import Sidebar from '../components/Sidebar/Sidebar';
import List from '../pages/List/List';
import TaskStatistics from '../pages/TaskStatistics/TaskStatistics';
import TaskNetwork from '../pages/TaskNetwork/TaskNetwork';
import Login from '../pages/Login/Login';
import Registration from '../pages/Registration/Registration';
import Invitations from '../pages/Invitations/Invitations';
import Profile from '../pages/Profile/Profile';
import GanttChart from '../pages/GanttChart/GanttChart';
import Footer from '../components/Footer/Footer';
import { getSocket } from '../socket';
import { ToastProvider, useToast } from '../context/ToastContext';

const Layout = ({ children, showMenuButton = true }) => {
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const authData = useSelector(selectAuthData);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();

    useEffect(() => {
        setSidebarVisible(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!authData?._id) return;

        const socket = getSocket();
        socket.emit('join', authData._id);

        const handleInvitationReceived = (data) => {
            dispatch(fetchAuthMe());
            const projectTitle = data?.groupId?.title || 'новий проєкт';
            showToast(`Вас запрошено до проєкту "${projectTitle}"!`, 'invite', {
                label: 'Переглянути →',
                onClick: () => navigate('/invitations'),
            });
        };

        const handleInvitationAccepted = (data) => {
            dispatch(fetchGroups());
            showToast(data?.message || 'Користувач прийняв запрошення до вашого проєкту!', 'success');
        };

        socket.on('invitation_received', handleInvitationReceived);
        socket.on('invitation_accepted', handleInvitationAccepted);

        return () => {
            socket.off('invitation_received', handleInvitationReceived);
            socket.off('invitation_accepted', handleInvitationAccepted);
        };
    }, [authData?._id, dispatch, navigate, showToast]);

    const toggleSidebar = () => {
        setSidebarVisible(!sidebarVisible);
    };

    return (
        <div className="mainContent">
            <Header toggleSidebar={toggleSidebar} showMenuButton={showMenuButton} />
            <div className="contentWrapper">
                {showMenuButton && (
                    <Sidebar 
                        isOpen={sidebarVisible} 
                        toggleSidebar={toggleSidebar} 
                        authData={authData} 
                        navigate={navigate} 
                    />
                )}
                <main className={showMenuButton && sidebarVisible ? 'sidebar-open' : ''}>
                    {children}
                </main>
            </div>
            <Footer />
        </div>
    );
};

function App() {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchAuthMe());
    }, [dispatch]);

    return (
        <div className="App">
            <BrowserRouter>
                <ToastProvider>
                    <Routes>
                        <Route path="/" element={<Layout><List /></Layout>} />
                        <Route path="/statistics" element={<Layout><TaskStatistics /></Layout>} />
                        <Route path="/network" element={<Layout><TaskNetwork /></Layout>} />
                        <Route path="/network/:groupId" element={<Layout><TaskNetwork /></Layout>} />
                        <Route path="/gantt" element={<Layout><GanttChart /></Layout>} />
                        <Route path="/gantt/:groupId" element={<Layout><GanttChart /></Layout>} />
                        <Route path="/login" element={<Layout showMenuButton={false}><Login /></Layout>} />
                        <Route path="/register" element={<Layout showMenuButton={false}><Registration /></Layout>} />
                        <Route path="/invitations" element={<Layout><Invitations /></Layout>} />
                        <Route path="/profile" element={<Layout><Profile /></Layout>} />
                    </Routes>
                </ToastProvider>
            </BrowserRouter>
        </div>
    );
}

export default App;