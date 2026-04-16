import { FC, ReactElement, useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Stack } from '@fluentui/react';
import Header from './header';
import NavBar from './navbar';
import { headerStackStyles, mainStackStyles, rootStackStyles, sidebarStackStyles } from '../ux/styles';
import DashboardPage from '../pages/DashboardPage';
import EmployeesPage from '../pages/EmployeesPage';
import TasksPage from '../pages/TasksPage';
import ProductivityPage from '../pages/ProductivityPage';
import CoachingPage from '../pages/CoachingPage';
import IssuesPage from '../pages/IssuesPage';
import SummaryPage from '../pages/SummaryPage';

const Layout: FC = (): ReactElement => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);
    const closeSidebar = useCallback(() => setSidebarOpen(false), []);

    return (
        <Stack styles={rootStackStyles}>
            {/* Top header bar */}
            <Stack.Item styles={headerStackStyles}>
                <Header onToggleSidebar={toggleSidebar} />
            </Stack.Item>

            {/* Sidebar + main content area */}
            <Stack horizontal grow={1} style={{ overflow: 'hidden', position: 'relative' }}>
                {/* Mobile backdrop */}
                <div
                    className={`sidebar-backdrop ${sidebarOpen ? 'sidebar-open' : ''}`}
                    onClick={closeSidebar}
                />
                {/* Sidebar */}
                <div className={`sidebar-wrapper ${sidebarOpen ? 'sidebar-open' : ''}`}>
                    <Stack.Item styles={sidebarStackStyles}>
                        <NavBar onLinkClick={closeSidebar} />
                    </Stack.Item>
                </div>
                <Stack.Item grow={1} styles={mainStackStyles} style={{ overflow: 'auto' }}>
                    <Routes>
                        <Route path="/"            element={<DashboardPage />} />
                        <Route path="/employees"   element={<EmployeesPage />} />
                        <Route path="/tasks"       element={<TasksPage />} />
                        <Route path="/productivity"element={<ProductivityPage />} />
                        <Route path="/coaching"    element={<CoachingPage />} />
                        <Route path="/issues"      element={<IssuesPage />} />
                        <Route path="/summary"     element={<SummaryPage />} />
                        {/* Catch-all — send unknown paths back to dashboard */}
                        <Route path="*"            element={<Navigate to="/" replace />} />
                    </Routes>
                </Stack.Item>
            </Stack>
        </Stack>
    );
};

export default Layout;
