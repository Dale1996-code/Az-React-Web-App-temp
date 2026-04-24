import { FC, ReactElement, lazy, Suspense, useCallback, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Stack } from '@fluentui/react';
import Header from './header';
import NavBar from './navbar';
import { headerStackStyles, mainStackStyles, rootStackStyles, sidebarStackStyles } from '../ux/styles';

const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const EmployeesPage = lazy(() => import('../pages/EmployeesPage'));
const TasksPage = lazy(() => import('../pages/TasksPage'));
const ProductivityPage = lazy(() => import('../pages/ProductivityPage'));
const CoachingPage = lazy(() => import('../pages/CoachingPage'));
const IssuesPage = lazy(() => import('../pages/IssuesPage'));
const SummaryPage = lazy(() => import('../pages/SummaryPage'));

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
                    <Suspense fallback={null}>
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
                    </Suspense>
                </Stack.Item>
            </Stack>
        </Stack>
    );
};

export default Layout;
